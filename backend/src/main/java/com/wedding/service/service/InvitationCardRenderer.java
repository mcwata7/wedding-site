package com.wedding.service.service;

import com.fasterxml.jackson.databind.ObjectMapper;
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
import java.util.regex.Pattern;
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
 * Renders a two-sided A6 QR invitation card to a multi-page PDF, two pages (front, back) per card,
 * alternating [front1, back1, front2, back2, ...] across the whole document -- the page order a
 * duplex-capable printer needs to auto-collate correctly (flip on the long edge in portrait, short
 * edge in landscape, or every back prints upside-down).
 *
 * This is a pure function of its inputs -- no DataService, no other Spring beans beyond the
 * @Service wiring -- so it is unit-testable with plain JUnit like JwtServiceTests. All SQL lookups
 * (site settings, media assets, invitation tokens) happen in the calling controller.
 *
 * The front side is pure planner-uploaded artwork -- nothing else is drawn on it. The back side
 * carries exactly three elements, each independently planner-positioned (free x/y, not just Y),
 * sized, and colored: the QR code, the "inviteUrl" line (host + "/i/" + token, one line), and the
 * "guestNames" line (the party's display name). Font is fixed in code for both text elements --
 * it's no longer planner-configurable. The whole card is either PORTRAIT (105x148mm) or LANDSCAPE
 * (148x105mm), one setting shared by both sides since they're the same physical sheet.
 */
@Service
public class InvitationCardRenderer {
  private static final float MM = 72f / 25.4f;
  private static float mm(double v) { return (float) (v * MM); }

  private static final Set<String> SUPPORTED_BACKGROUND = Set.of("image/jpeg", "image/png");
  // Both text elements shrink-to-fit within this width if they'd otherwise overflow.
  private static final float TEXT_MAX_WIDTH_MM = 95f;
  private static final Pattern HEX_COLOR = Pattern.compile("^#[0-9a-fA-F]{6}$");

  // Font is code-owned, not planner-editable: Courier disambiguates token characters on the invite
  // URL line; Helvetica-Oblique matches the look the old default "partyName" field always had.
  private static final PDFont URL_FONT = new PDType1Font(Standard14Fonts.FontName.COURIER);
  private static final PDFont NAMES_FONT = new PDType1Font(Standard14Fonts.FontName.HELVETICA_OBLIQUE);

  public enum Orientation {
    PORTRAIT, LANDSCAPE;
    public float widthMm() { return this == PORTRAIT ? 105f : 148f; }
    public float heightMm() { return this == PORTRAIT ? 148f : 105f; }
  }

  /** x,y = center anchor in mm; size = mm (edge length of the square QR symbol). */
  public record QrLayout(float x, float y, float size, String color) {}
  /** x,y = center anchor in mm (x = horizontal center, y = the text baseline); size = font size
   * in points. */
  public record TextLayout(float x, float y, float size, String color) {}

  public record CardLayout(QrLayout qr, TextLayout inviteUrl, TextLayout guestNames) {
    /** Fills in any missing element from DEFAULT_LAYOUT -- a saved layout from before an element
     * existed, or a partial preview payload, still renders instead of NPEing. */
    public CardLayout withDefaults() {
      return new CardLayout(
        qr == null ? DEFAULT_LAYOUT.qr() : qr,
        inviteUrl == null ? DEFAULT_LAYOUT.inviteUrl() : inviteUrl,
        guestNames == null ? DEFAULT_LAYOUT.guestNames() : guestNames);
    }
  }

  /** Modeled on a blank back side (no more card.jpg-specific placeholder to model against, now
   * that the back is an arbitrary planner-uploaded image) -- a simple vertical distribution
   * centered on the card, QR in the middle. Mirrors V17__invitation_card_two_sided.sql's default
   * -- keep the two in sync if either changes. */
  public static final CardLayout DEFAULT_LAYOUT = new CardLayout(
    new QrLayout(52.5f, 74f, 40f, "#000000"),
    new TextLayout(52.5f, 48f, 6f, "#737373"),
    new TextLayout(52.5f, 108f, 11f, "#000000"));

  public record CardTheme(byte[] front, String frontContentType, byte[] back, String backContentType,
                           String baseUrl, Orientation orientation, CardLayout layout) {}
  public record Card(String guestNames, String token) {}

  /** Which of a card's two sides to emit a page for -- BOTH for real print jobs (front/back must
   * stay paired for duplex collation), FRONT/BACK for a single-page preview render. */
  public enum Side { FRONT, BACK, BOTH }

  /** raw is the already jsonb-decoded value from DataService (a nested Map), or null if the
   * column hasn't been set yet (e.g. a preview payload that omits it entirely). */
  public static CardLayout parseLayout(Object raw, ObjectMapper json) {
    if (raw == null) return new CardLayout(null, null, null);
    return json.convertValue(raw, CardLayout.class);
  }

  /** Shared by render-time and PATCH-time validation, so a bad value is caught on save, not only
   * when a PDF happens to be requested later. */
  public static CardLayout validate(CardLayout layout, Orientation o) {
    validateText(layout.inviteUrl(), "inviteUrl", o);
    validateText(layout.guestNames(), "guestNames", o);
    QrLayout qr = layout.qr();
    if (qr.x() < 0 || qr.x() > o.widthMm())
      throw new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, "INVALID_LAYOUT", "QR x position must be between 0 and " + o.widthMm() + "mm");
    if (qr.y() < 0 || qr.y() > o.heightMm())
      throw new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, "INVALID_LAYOUT", "QR y position must be between 0 and " + o.heightMm() + "mm");
    // Floor raised from a naive 5mm: below ~20mm a realistic invite URL's QR module size drops
    // under the 0.5mm scan-density floor drawQr enforces, so a smaller saved value would validate
    // fine here and then 422 on every render. See docs/DECISIONS.md.
    float maxQr = Math.min(o.widthMm(), o.heightMm());
    if (qr.size() < 20 || qr.size() > maxQr)
      throw new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, "INVALID_LAYOUT", "QR size must be between 20 and " + maxQr + "mm");
    if (!HEX_COLOR.matcher(qr.color()).matches())
      throw new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, "INVALID_LAYOUT", "QR color must be a hex value like #1a1a1a");
    return layout;
  }

  private static void validateText(TextLayout t, String label, Orientation o) {
    if (t.size() < 4 || t.size() > 72)
      throw new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, "INVALID_LAYOUT", "Font size for \"" + label + "\" must be between 4 and 72");
    if (t.x() < 0 || t.x() > o.widthMm())
      throw new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, "INVALID_LAYOUT", "X position for \"" + label + "\" must be between 0 and " + o.widthMm() + "mm");
    if (t.y() < 0 || t.y() > o.heightMm())
      throw new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, "INVALID_LAYOUT", "Y position for \"" + label + "\" must be between 0 and " + o.heightMm() + "mm");
    if (t.color() == null || !HEX_COLOR.matcher(t.color()).matches())
      throw new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, "INVALID_LAYOUT", "Color for \"" + label + "\" must be a hex value like #1a1a1a");
  }

  public byte[] render(CardTheme theme, List<Card> cards, double bleedMm) {
    return render(theme, cards, bleedMm, Side.BOTH);
  }

  public byte[] render(CardTheme theme, List<Card> cards, double bleedMm, Side side) {
    if (theme.front() != null && !SUPPORTED_BACKGROUND.contains(theme.frontContentType()))
      throw new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, "UNSUPPORTED_BACKGROUND", "Card front image must be a JPEG or PNG image");
    if (theme.back() != null && !SUPPORTED_BACKGROUND.contains(theme.backContentType()))
      throw new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, "UNSUPPORTED_BACKGROUND", "Card back image must be a JPEG or PNG image");

    Orientation o = theme.orientation() == null ? Orientation.PORTRAIT : theme.orientation();
    CardLayout layout = validate(theme.layout().withDefaults(), o);
    for (Card c : cards) sanitizeText(NAMES_FONT, c.guestNames());

    float bleed = mm(Math.max(0, Math.min(bleedMm, 5)));
    float pageW = mm(o.widthMm()), pageH = mm(o.heightMm());
    try (PDDocument doc = new PDDocument()) {
      PDImageXObject front = theme.front() == null ? null : PDImageXObject.createFromByteArray(doc, theme.front(), "card-front");
      PDImageXObject back = theme.back() == null ? null : PDImageXObject.createFromByteArray(doc, theme.back(), "card-back");
      String host = displayHost(theme.baseUrl());
      for (Card card : cards) {
        if (side != Side.BACK) addPage(doc, pageW, pageH, bleed, cs -> drawBackground(cs, front, bleed, pageW, pageH));
        if (side != Side.FRONT) {
          String inviteUrl = host + "/i/" + card.token();
          String qrUrl = stripTrailingSlash(theme.baseUrl()) + "/i/" + card.token();
          addPage(doc, pageW, pageH, bleed, cs -> drawBack(cs, back, bleed, pageW, pageH, layout, inviteUrl, qrUrl, card.guestNames()));
        }
      }
      ByteArrayOutputStream out = new ByteArrayOutputStream();
      doc.save(out);
      return out.toByteArray();
    } catch (IOException e) {
      throw new IllegalStateException("Failed to render invitation card PDF", e);
    }
  }

  private interface PageDrawer { void draw(PDPageContentStream cs) throws IOException; }

  private void addPage(PDDocument doc, float pageW, float pageH, float bleed, PageDrawer drawer) throws IOException {
    PDPage page = new PDPage(new PDRectangle(pageW + 2 * bleed, pageH + 2 * bleed));
    doc.addPage(page);
    try (PDPageContentStream cs = new PDPageContentStream(doc, page)) {
      cs.transform(Matrix.getTranslateInstance(bleed, bleed));
      drawer.draw(cs);
    }
  }

  private void drawBack(PDPageContentStream cs, PDImageXObject back, float bleed, float pageW, float pageH,
                         CardLayout layout, String inviteUrl, String qrUrl, String guestNames) throws IOException {
    drawBackground(cs, back, bleed, pageW, pageH);
    drawQr(cs, qrUrl, layout.qr());
    drawCentered(cs, URL_FONT, fitSize(URL_FONT, inviteUrl, layout.inviteUrl().size()), inviteUrl, layout.inviteUrl().x(), layout.inviteUrl().y(), parseColor(layout.inviteUrl().color()));
    drawCentered(cs, NAMES_FONT, fitSize(NAMES_FONT, guestNames, layout.guestNames().size()), guestNames, layout.guestNames().x(), layout.guestNames().y(), parseColor(layout.guestNames().color()));
  }

  /**
   * Cover-fit: uniform scale so the image fills the page (plus bleed), centered on both axes with
   * overflow clipped away -- no distortion, unlike a stretch-to-fill. A plain white fill under/behind
   * it is the fallback when there's no background image at all.
   */
  private void drawBackground(PDPageContentStream cs, PDImageXObject img, float bleed, float pageW, float pageH) throws IOException {
    float boxX = -bleed, boxY = -bleed, boxW = pageW + 2 * bleed, boxH = pageH + 2 * bleed;
    cs.setNonStrokingColor(1f, 1f, 1f);
    cs.addRect(boxX, boxY, boxW, boxH);
    cs.fill();
    if (img == null) return;
    float scale = Math.max(boxW / img.getWidth(), boxH / img.getHeight());
    float w = img.getWidth() * scale, h = img.getHeight() * scale;
    cs.saveGraphicsState();
    cs.addRect(boxX, boxY, boxW, boxH);
    cs.clip();
    cs.drawImage(img, boxX + (boxW - w) / 2, boxY + (boxH - h) / 2, w, h);
    cs.restoreGraphicsState();
  }

  /** Draws the QR as filled rectangles, merging horizontal runs of dark modules to keep the content
   * stream small. Center-anchored at (qr.x, qr.y). Modules are filled with the layout's own QR
   * color rather than always black -- see docs/DECISIONS.md for why that's now planner-editable. */
  private void drawQr(PDPageContentStream cs, String url, QrLayout qr) throws IOException {
    ByteMatrix matrix;
    try {
      matrix = Encoder.encode(url, ErrorCorrectionLevel.M, Map.of(EncodeHintType.CHARACTER_SET, "UTF-8")).getMatrix();
    } catch (WriterException e) {
      throw new IllegalStateException("Failed to encode QR code", e);
    }
    int size = matrix.getWidth();
    float mod = mm(qr.size()) / size;
    if (mod < mm(0.5)) throw new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, "QR_TOO_DENSE", "The invitation URL is too long to render a legible QR code");
    float x0 = mm(qr.x()) - mm(qr.size()) / 2, y0 = mm(qr.y()) - mm(qr.size()) / 2;
    float[] rgb = parseColor(qr.color());
    cs.setNonStrokingColor(rgb[0], rgb[1], rgb[2]);
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

  /** Steps the font size down in 0.5pt increments until the text fits TEXT_MAX_WIDTH_MM, or a
   * proportional floor is hit. startSize is the planner's chosen (ceiling) size. */
  private float fitSize(PDFont font, String text, float startSize) throws IOException {
    if (text == null || text.isBlank()) return startSize;
    float size = startSize, minSize = Math.max(startSize * 0.6f, 4.5f);
    while (size > minSize && font.getStringWidth(text) / 1000 * size > mm(TEXT_MAX_WIDTH_MM)) size -= 0.5f;
    return size;
  }

  private void drawCentered(PDPageContentStream cs, PDFont font, float size, String text, float centerXmm, float baselineYmm, float[] rgb) throws IOException {
    if (text == null || text.isBlank()) return;
    float width = font.getStringWidth(text) / 1000 * size;
    cs.beginText();
    cs.setFont(font, size);
    cs.setNonStrokingColor(rgb[0], rgb[1], rgb[2]);
    cs.newLineAtOffset(mm(centerXmm) - width / 2, mm(baselineYmm));
    cs.showText(text);
    cs.endText();
  }

  /** Parses a `#rrggbb` hex string (already validated by CardLayout.validate()) into 0-1 RGB floats. */
  private static float[] parseColor(String hex) {
    int r = Integer.parseInt(hex.substring(1, 3), 16);
    int g = Integer.parseInt(hex.substring(3, 5), 16);
    int b = Integer.parseInt(hex.substring(5, 7), 16);
    return new float[]{r / 255f, g / 255f, b / 255f};
  }

  /** Standard-14 fonts are WinAnsi-encoded (Latin-1 + extras) -- fail fast with a clear error instead of a 500 mid-render. */
  private void sanitizeText(PDFont font, String text) {
    if (text == null || text.isBlank()) return;
    try {
      font.getStringWidth(text);
    } catch (Exception e) {
      throw new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, "UNPRINTABLE_TEXT", "Card text contains a character that can't be printed: \"" + text + "\"");
    }
  }

  private static String stripTrailingSlash(String url) { return url.endsWith("/") ? url.substring(0, url.length() - 1) : url; }
  private static String displayHost(String url) { return stripTrailingSlash(url).replaceFirst("^[a-zA-Z]+://", ""); }
}
