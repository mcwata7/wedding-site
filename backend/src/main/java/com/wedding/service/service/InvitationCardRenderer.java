package com.wedding.service.service;

import com.google.zxing.EncodeHintType;
import com.google.zxing.WriterException;
import com.google.zxing.qrcode.decoder.ErrorCorrectionLevel;
import com.google.zxing.qrcode.encoder.ByteMatrix;
import com.google.zxing.qrcode.encoder.Encoder;
import com.wedding.service.api.ApiException;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.apache.pdfbox.pdmodel.font.PDFont;
import org.apache.pdfbox.pdmodel.font.PDType1Font;
import org.apache.pdfbox.pdmodel.font.Standard14Fonts;
import org.apache.pdfbox.pdmodel.graphics.image.PDImageXObject;
import org.apache.pdfbox.util.Matrix;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

/**
 * Renders A6 (105 x 148mm) QR invitation cards to a multi-page PDF, one page per card.
 *
 * This is a pure function of its inputs -- no DataService, no other Spring beans beyond the
 * @Service wiring -- so it is unit-testable with plain JUnit like JwtServiceTests. All SQL
 * lookups (site settings, media assets, invitation tokens) happen in the calling controller.
 *
 * The QR is drawn as vector rectangles from a ZXing ByteMatrix rather than rasterized to a PNG,
 * so it stays crisp at any print resolution.
 */
@Service
public class InvitationCardRenderer {
  private static final float MM = 72f / 25.4f;
  private static float mm(double v) { return (float) (v * MM); }

  private static final float PAGE_W = mm(105), PAGE_H = mm(148);
  private static final Set<String> SUPPORTED_ARTWORK = Set.of("image/jpeg", "image/png");
  // QR is drawn as a box QR_BOX_MM square, centered at QR_X_MM, with its bottom edge at QR_Y_MM.
  private static final float QR_BOX_MM = 28f, QR_X_MM = 52.5f, QR_Y_MM = 18f;

  public record CardTheme(String coupleNames, String dateLine, String headline, String body, String footer,
                           byte[] artwork, String artworkContentType, String baseUrl) {}
  public record Card(String partyName, String token) {}

  public byte[] render(CardTheme theme, List<Card> cards, double bleedMm) {
    if (theme.artwork() != null && !SUPPORTED_ARTWORK.contains(theme.artworkContentType()))
      throw new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, "UNSUPPORTED_ARTWORK", "Card artwork must be a JPEG or PNG image");

    PDFont regular = new PDType1Font(Standard14Fonts.FontName.HELVETICA);
    PDFont bold = new PDType1Font(Standard14Fonts.FontName.HELVETICA_BOLD);
    PDFont italic = new PDType1Font(Standard14Fonts.FontName.HELVETICA_OBLIQUE);
    PDFont mono = new PDType1Font(Standard14Fonts.FontName.COURIER);
    sanitize(regular, theme.dateLine(), theme.body(), theme.footer());
    sanitize(bold, theme.coupleNames());
    sanitize(italic, theme.headline());
    for (Card c : cards) sanitize(italic, c.partyName());

    float bleed = mm(Math.max(0, Math.min(bleedMm, 5)));
    try (PDDocument doc = new PDDocument()) {
      PDImageXObject artwork = theme.artwork() == null ? null : PDImageXObject.createFromByteArray(doc, theme.artwork(), "card-artwork");
      String host = displayHost(theme.baseUrl());
      for (Card card : cards) {
        PDPage page = new PDPage(new PDRectangle(PAGE_W + 2 * bleed, PAGE_H + 2 * bleed));
        doc.addPage(page);
        try (PDPageContentStream cs = new PDPageContentStream(doc, page)) {
          cs.transform(Matrix.getTranslateInstance(bleed, bleed));
          drawCard(cs, theme, card, artwork, host, regular, bold, italic, mono);
        }
      }
      ByteArrayOutputStream out = new ByteArrayOutputStream();
      doc.save(out);
      return out.toByteArray();
    } catch (IOException e) {
      throw new IllegalStateException("Failed to render invitation card PDF", e);
    }
  }

  private void drawCard(PDPageContentStream cs, CardTheme theme, Card card, PDImageXObject artwork, String host,
                         PDFont regular, PDFont bold, PDFont italic, PDFont mono) throws IOException {
    cs.setNonStrokingColor(1f, 1f, 1f);
    cs.addRect(0, 0, PAGE_W, PAGE_H);
    cs.fill();

    drawArtwork(cs, artwork, 29.5f, 96f, 46f, 44f);

    drawCentered(cs, italic, 10f, theme.headline(), 52.5f, 90f, 0f);
    drawCentered(cs, bold, fitSize(bold, theme.coupleNames(), 85, 17, 11), theme.coupleNames(), 52.5f, 80f, 0f);
    drawCentered(cs, regular, 9.5f, theme.dateLine(), 52.5f, 72f, 0f);
    drawCentered(cs, regular, fitSize(regular, theme.body(), 85, 8.5f, 6), theme.body(), 52.5f, 64f, 0f);

    cs.setLineWidth(0.4f);
    cs.moveTo(mm(40), mm(58));
    cs.lineTo(mm(65), mm(58));
    cs.stroke();

    drawCentered(cs, italic, fitSize(italic, card.partyName(), 85, 10.5f, 8), card.partyName(), 52.5f, 52f, 0f);

    String qrUrl = stripTrailingSlash(theme.baseUrl()) + "/i/" + card.token();
    drawQr(cs, qrUrl);

    drawCentered(cs, regular, 8f, theme.footer(), 52.5f, 13f, 0f);
    String hostLine = host + "/i/";
    drawCentered(cs, regular, fitSize(regular, hostLine, 90, 6.5f, 5), hostLine, 52.5f, 9f, 0.45f);
    drawCentered(cs, mono, fitSize(mono, card.token(), 90, 6f, 4.5f), card.token(), 52.5f, 5f, 0.45f);
  }

  /** Aspect-ratio-preserving contain-fit inside the given box (mm), centered on both axes. */
  private void drawArtwork(PDPageContentStream cs, PDImageXObject img, float boxXmm, float boxYmm, float boxWmm, float boxHmm) throws IOException {
    if (img == null) return;
    float boxW = mm(boxWmm), boxH = mm(boxHmm);
    float ar = (float) img.getWidth() / img.getHeight();
    boolean fitWidth = ar >= boxW / boxH;
    float w = fitWidth ? boxW : boxH * ar;
    float h = fitWidth ? boxW / ar : boxH;
    cs.drawImage(img, mm(boxXmm) + (boxW - w) / 2, mm(boxYmm) + (boxH - h) / 2, w, h);
  }

  /** Draws the QR as filled rectangles, merging horizontal runs of dark modules to keep the content stream small. */
  private void drawQr(PDPageContentStream cs, String url) throws IOException {
    ByteMatrix matrix;
    try {
      matrix = Encoder.encode(url, ErrorCorrectionLevel.M, Map.of(EncodeHintType.CHARACTER_SET, "UTF-8")).getMatrix();
    } catch (WriterException e) {
      throw new IllegalStateException("Failed to encode QR code", e);
    }
    int size = matrix.getWidth();
    float mod = mm(QR_BOX_MM) / size;
    if (mod < mm(0.5)) throw new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, "QR_TOO_DENSE", "The invitation URL is too long to render a legible QR code");
    float x0 = mm(QR_X_MM) - mm(QR_BOX_MM) / 2, y0 = mm(QR_Y_MM);
    cs.setNonStrokingColor(0f, 0f, 0f);
    for (int row = 0; row < size; row++) {
      int col = 0;
      while (col < size) {
        if (matrix.get(col, row) != 1) { col++; continue; }
        int start = col;
        while (col < size && matrix.get(col, row) == 1) col++;
        // matrix row 0 is the top of the symbol, but PDF y grows upward -- flip the row.
        cs.addRect(x0 + start * mod, y0 + (size - 1 - row) * mod, (col - start) * mod, mod);
      }
    }
    cs.fill();
  }

  /** Steps the font size down in 0.5pt increments until the text fits maxWidthMm, or the floor is hit. */
  private float fitSize(PDFont font, String text, float maxWidthMm, float startSize, float minSize) throws IOException {
    if (text == null || text.isBlank()) return startSize;
    float size = startSize;
    while (size > minSize && font.getStringWidth(text) / 1000 * size > mm(maxWidthMm)) size -= 0.5f;
    return size;
  }

  private void drawCentered(PDPageContentStream cs, PDFont font, float size, String text, float centerXmm, float baselineYmm, float gray) throws IOException {
    if (text == null || text.isBlank()) return;
    float width = font.getStringWidth(text) / 1000 * size;
    cs.beginText();
    cs.setFont(font, size);
    cs.setNonStrokingColor(gray, gray, gray);
    cs.newLineAtOffset(mm(centerXmm) - width / 2, mm(baselineYmm));
    cs.showText(text);
    cs.endText();
  }

  /** Standard-14 fonts are WinAnsi-encoded (Latin-1 + extras) -- fail fast with a clear error instead of a 500 mid-render. */
  private void sanitize(PDFont font, String... values) {
    for (String v : values) {
      if (v == null || v.isBlank()) continue;
      try {
        font.getStringWidth(v);
      } catch (Exception e) {
        throw new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, "UNPRINTABLE_TEXT", "Card text contains a character that can't be printed: \"" + v + "\"");
      }
    }
  }

  private static String stripTrailingSlash(String url) { return url.endsWith("/") ? url.substring(0, url.length() - 1) : url; }
  private static String displayHost(String url) { return stripTrailingSlash(url).replaceFirst("^[a-zA-Z]+://", ""); }
}
