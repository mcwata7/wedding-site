package com.wedding.service.service;

import static org.junit.jupiter.api.Assertions.*;

import com.google.zxing.BinaryBitmap;
import com.google.zxing.MultiFormatReader;
import com.google.zxing.NotFoundException;
import com.google.zxing.Result;
import com.google.zxing.client.j2se.BufferedImageLuminanceSource;
import com.google.zxing.common.HybridBinarizer;
import com.wedding.service.api.ApiException;
import com.wedding.service.service.InvitationCardRenderer.Card;
import com.wedding.service.service.InvitationCardRenderer.CardLayout;
import com.wedding.service.service.InvitationCardRenderer.CardTheme;
import com.wedding.service.service.InvitationCardRenderer.Orientation;
import com.wedding.service.service.InvitationCardRenderer.QrLayout;
import com.wedding.service.service.InvitationCardRenderer.TextLayout;
import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.util.List;
import javax.imageio.ImageIO;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.rendering.PDFRenderer;
import org.apache.pdfbox.text.PDFTextStripper;
import org.apache.pdfbox.text.PDFTextStripperByArea;
import org.junit.jupiter.api.Test;

/**
 * Plain JUnit 5, no Spring context, no Mockito -- matching JwtServiceTests. InvitationCardRenderer
 * is deliberately a pure function of its inputs so it can be tested this way.
 *
 * The card is two pages per Card: page 0 (0-based, as PDFBox's PDDocument indexes) is the front
 * (pure image, nothing drawn), page 1 is the back (QR + inviteUrl + guestNames, nothing else drawn
 * behind them). Most assertions below target page index 1 for that reason.
 */
class InvitationCardRendererTests {
  private final InvitationCardRenderer renderer = new InvitationCardRenderer();

  private static CardTheme theme() { return theme(InvitationCardRenderer.DEFAULT_LAYOUT); }
  private static CardTheme theme(CardLayout layout) {
    return new CardTheme(null, null, null, null, "https://ourwedding.example", Orientation.PORTRAIT, layout);
  }
  private static CardTheme theme(Orientation o, CardLayout layout) {
    return new CardTheme(null, null, null, null, "https://ourwedding.example", o, layout);
  }

  @Test void rendersTwoPagesPerCard() throws Exception {
    byte[] pdf = renderer.render(theme(), List.of(new Card("Sharma Family", "tok-one"), new Card("Thapa Family", "tok-two")), 0);
    assertTrue(new String(pdf, 0, 5).startsWith("%PDF"));
    try (PDDocument doc = Loader.loadPDF(pdf)) {
      assertEquals(4, doc.getNumberOfPages());
      String text = new PDFTextStripper().getText(doc);
      assertTrue(text.contains("Sharma Family"));
      assertTrue(text.contains("Thapa Family"));
      assertTrue(text.contains("tok-one"));
      assertTrue(text.contains("tok-two"));

      for (int frontPage : new int[]{1, 3}) { // 1-based PDFTextStripper page numbers
        assertTrue(pageText(doc, frontPage).isBlank(), "front page " + frontPage + " should carry no text");
      }
      for (int backPage : new int[]{2, 4}) {
        assertFalse(pageText(doc, backPage).isBlank(), "back page " + backPage + " should carry text");
      }
    }
  }

  @Test void frontSideIsPureImage() throws Exception {
    CardTheme t = new CardTheme(solidJpeg(new Color(200, 150, 100)), "image/jpeg", null, null, "https://example.com", Orientation.PORTRAIT, InvitationCardRenderer.DEFAULT_LAYOUT);
    byte[] pdf = renderer.render(t, List.of(new Card("Family", "tok")), 0);
    try (PDDocument doc = Loader.loadPDF(pdf)) {
      assertTrue(pageText(doc, 1).isBlank(), "front page should carry no text");
      BufferedImage front = new PDFRenderer(doc).renderImageWithDPI(0, 150);
      BinaryBitmap bitmap = new BinaryBitmap(new HybridBinarizer(new BufferedImageLuminanceSource(front)));
      assertThrows(NotFoundException.class, () -> new MultiFormatReader().decode(bitmap));
    }
  }

  @Test void qrEncodesTheFullInvitationUrl() throws Exception {
    byte[] pdf = renderer.render(theme(), List.of(new Card("Gurung Family", "abc123-xyz")), 0);
    try (PDDocument doc = Loader.loadPDF(pdf)) {
      BufferedImage page = new PDFRenderer(doc).renderImageWithDPI(1, 300);
      BinaryBitmap bitmap = new BinaryBitmap(new HybridBinarizer(new BufferedImageLuminanceSource(page)));
      Result result = new MultiFormatReader().decode(bitmap);
      assertEquals("https://ourwedding.example/i/abc123-xyz", result.getText());
    }
  }

  @Test void bleedEnlargesThePage() throws Exception {
    byte[] pdf = renderer.render(theme(), List.of(new Card("Family", "tok")), 3);
    try (PDDocument doc = Loader.loadPDF(pdf)) {
      for (int i = 0; i < 2; i++) {
        var box = doc.getPage(i).getMediaBox();
        assertEquals(105 + 6, Math.round(box.getWidth() / (72f / 25.4f)));
        assertEquals(148 + 6, Math.round(box.getHeight() / (72f / 25.4f)));
      }
    }
  }

  @Test void rejectsUnprintableCharacters() {
    CardTheme t = theme();
    assertThrows(ApiException.class, () -> renderer.render(t, List.of(new Card("सुन्दर", "tok")), 0));
  }

  @Test void rejectsWebpFrontBackground() {
    CardTheme t = new CardTheme(new byte[]{1, 2, 3}, "image/webp", null, null, "https://example.com", Orientation.PORTRAIT, InvitationCardRenderer.DEFAULT_LAYOUT);
    assertThrows(ApiException.class, () -> renderer.render(t, List.of(new Card("Family", "tok")), 0));
  }

  @Test void rejectsWebpBackBackground() {
    CardTheme t = new CardTheme(null, null, new byte[]{1, 2, 3}, "image/webp", "https://example.com", Orientation.PORTRAIT, InvitationCardRenderer.DEFAULT_LAYOUT);
    assertThrows(ApiException.class, () -> renderer.render(t, List.of(new Card("Family", "tok")), 0));
  }

  /** There is no legibility plate behind the QR any more (removed so the QR, guestNames, and
   * inviteUrl render directly over the back artwork with nothing drawn behind them) -- this just
   * checks a near-black back image doesn't break decoding for the default black QR color. Planners
   * are responsible for choosing a QR/text color with enough contrast against their own artwork;
   * the live preview is how they catch that before printing (see docs/DECISIONS.md). */
  @Test void qrStaysScannableOverADarkBackground() throws Exception {
    CardTheme t = new CardTheme(null, null, solidJpeg(new Color(10, 10, 10)), "image/jpeg", "https://ourwedding.example", Orientation.PORTRAIT, InvitationCardRenderer.DEFAULT_LAYOUT);
    byte[] pdf = renderer.render(t, List.of(new Card("Family", "abc123-xyz")), 0);
    try (PDDocument doc = Loader.loadPDF(pdf)) {
      BufferedImage page = new PDFRenderer(doc).renderImageWithDPI(1, 300);
      BinaryBitmap bitmap = new BinaryBitmap(new HybridBinarizer(new BufferedImageLuminanceSource(page)));
      Result result = new MultiFormatReader().decode(bitmap);
      assertEquals("https://ourwedding.example/i/abc123-xyz", result.getText());
    }
  }

  @Test void backgroundFillsTheBledPageOnFront() throws Exception {
    CardTheme t = new CardTheme(solidJpeg(new Color(220, 20, 20)), "image/jpeg", null, null, "https://example.com", Orientation.PORTRAIT, InvitationCardRenderer.DEFAULT_LAYOUT);
    byte[] pdf = renderer.render(t, List.of(new Card("Family", "tok")), 3);
    try (PDDocument doc = Loader.loadPDF(pdf)) {
      BufferedImage front = new PDFRenderer(doc).renderImageWithDPI(0, 150);
      int corner = front.getRGB(5, 5);
      assertNotEquals(Color.WHITE.getRGB() | 0xFF000000, corner | 0xFF000000, "corner of the bleed area should show the front background, not blank white");
    }
  }

  @Test void backgroundFillsTheBledPageOnBack() throws Exception {
    CardTheme t = new CardTheme(null, null, solidJpeg(new Color(20, 120, 220)), "image/jpeg", "https://example.com", Orientation.PORTRAIT, InvitationCardRenderer.DEFAULT_LAYOUT);
    byte[] pdf = renderer.render(t, List.of(new Card("Family", "tok")), 3);
    try (PDDocument doc = Loader.loadPDF(pdf)) {
      BufferedImage back = new PDFRenderer(doc).renderImageWithDPI(1, 150);
      int backCorner = back.getRGB(5, 5);
      assertNotEquals(Color.WHITE.getRGB() | 0xFF000000, backCorner | 0xFF000000, "corner of the bleed area should show the back background, not blank white");

      BufferedImage front = new PDFRenderer(doc).renderImageWithDPI(0, 150);
      int frontCorner = front.getRGB(5, 5);
      assertEquals(Color.WHITE.getRGB() | 0xFF000000, frontCorner | 0xFF000000, "front stays blank white when only the back has an image");
    }
  }

  @Test void customLayoutShiftsGuestNamesYPosition() throws Exception {
    TextLayout moved = new TextLayout(52.5f, 130f, 11f, "#000000"); // moved from the default 108mm up near the top
    CardLayout layout = new CardLayout(InvitationCardRenderer.DEFAULT_LAYOUT.qr(), InvitationCardRenderer.DEFAULT_LAYOUT.inviteUrl(), moved);
    byte[] pdf = renderer.render(theme(layout), List.of(new Card("Zed & Yara", "tok")), 0);
    try (PDDocument doc = Loader.loadPDF(pdf)) {
      PDPage back = doc.getPage(1);
      assertTrue(regionText(back, 0, 10, 105, 20).contains("Zed & Yara"), "moved text should land near the top");
      assertFalse(regionText(back, 0, 35, 105, 15).contains("Zed & Yara"), "moved text should no longer be at the default band");
    }
  }

  @Test void customLayoutShiftsGuestNamesXPosition() throws Exception {
    TextLayout moved = new TextLayout(20f, 108f, 11f, "#000000"); // left side instead of centered
    CardLayout layout = new CardLayout(InvitationCardRenderer.DEFAULT_LAYOUT.qr(), InvitationCardRenderer.DEFAULT_LAYOUT.inviteUrl(), moved);
    byte[] pdf = renderer.render(theme(layout), List.of(new Card("Zed & Yara", "tok")), 0);
    try (PDDocument doc = Loader.loadPDF(pdf)) {
      PDPage back = doc.getPage(1);
      assertTrue(regionText(back, 0, 35, 52, 15).contains("Zed & Yara"), "moved text should land in the left half");
      assertFalse(regionText(back, 53, 35, 52, 15).contains("Zed & Yara"), "moved text should no longer be centered/right");
    }
  }

  @Test void invalidTextColorIsRejected() {
    TextLayout bad = new TextLayout(52.5f, 48f, 6f, "not-a-color");
    CardLayout layout = new CardLayout(InvitationCardRenderer.DEFAULT_LAYOUT.qr(), bad, InvitationCardRenderer.DEFAULT_LAYOUT.guestNames());
    CardTheme t = theme(layout);
    ApiException ex = assertThrows(ApiException.class, () -> renderer.render(t, List.of(new Card("Family", "tok")), 0));
    assertEquals("INVALID_LAYOUT", ex.code);
  }

  @Test void invalidQrColorIsRejected() {
    QrLayout bad = new QrLayout(52.5f, 74f, 40f, "not-a-color");
    CardLayout layout = new CardLayout(bad, InvitationCardRenderer.DEFAULT_LAYOUT.inviteUrl(), InvitationCardRenderer.DEFAULT_LAYOUT.guestNames());
    CardTheme t = theme(layout);
    ApiException ex = assertThrows(ApiException.class, () -> renderer.render(t, List.of(new Card("Family", "tok")), 0));
    assertEquals("INVALID_LAYOUT", ex.code);
  }

  /** Reversal of a prior "Rejected" decision -- the QR now honors a planner-chosen color instead
   * of always drawing black. */
  @Test void plannerQrColorIsHonored() throws Exception {
    QrLayout blueQr = new QrLayout(52.5f, 74f, 40f, "#1155cc");
    CardLayout layout = new CardLayout(blueQr, InvitationCardRenderer.DEFAULT_LAYOUT.inviteUrl(), InvitationCardRenderer.DEFAULT_LAYOUT.guestNames());
    byte[] pdf = renderer.render(theme(layout), List.of(new Card("Family", "abc12345")), 0);
    try (PDDocument doc = Loader.loadPDF(pdf)) {
      BufferedImage back = new PDFRenderer(doc).renderImageWithDPI(1, 150);
      int target = new Color(0x11, 0x55, 0xcc).getRGB() & 0xFFFFFF;
      boolean foundBlue = false;
      for (int y = 0; y < back.getHeight() && !foundBlue; y += 2) {
        for (int x = 0; x < back.getWidth() && !foundBlue; x += 2) {
          if (closeColor(back.getRGB(x, y) & 0xFFFFFF, target)) foundBlue = true;
        }
      }
      assertTrue(foundBlue, "QR should be drawn in the planner-chosen color");
    }
  }

  @Test void partialLayoutMergesOverDefaults() throws Exception {
    CardLayout partial = new CardLayout(null, null, null);
    byte[] pdf = renderer.render(theme(partial), List.of(new Card("Family", "tok")), 0);
    assertTrue(new String(pdf, 0, 5).startsWith("%PDF"));
  }

  @Test void qrDecodesAtACustomPositionAndSize() throws Exception {
    QrLayout custom = new QrLayout(70f, 100f, 40f, "#000000");
    CardLayout layout = new CardLayout(custom, InvitationCardRenderer.DEFAULT_LAYOUT.inviteUrl(), InvitationCardRenderer.DEFAULT_LAYOUT.guestNames());
    byte[] pdf = renderer.render(theme(layout), List.of(new Card("Family", "moved-qr")), 0);
    try (PDDocument doc = Loader.loadPDF(pdf)) {
      BufferedImage page = new PDFRenderer(doc).renderImageWithDPI(1, 300);
      BinaryBitmap bitmap = new BinaryBitmap(new HybridBinarizer(new BufferedImageLuminanceSource(page)));
      Result result = new MultiFormatReader().decode(bitmap);
      assertEquals("https://ourwedding.example/i/moved-qr", result.getText());
    }
  }

  @Test void noBackImageStillRendersAScannableBack() throws Exception {
    CardTheme t = new CardTheme(null, null, null, null, "https://ourwedding.example", Orientation.PORTRAIT, InvitationCardRenderer.DEFAULT_LAYOUT);
    byte[] pdf = renderer.render(t, List.of(new Card("Family", "no-back-img")), 0);
    try (PDDocument doc = Loader.loadPDF(pdf)) {
      BufferedImage page = new PDFRenderer(doc).renderImageWithDPI(1, 300);
      BinaryBitmap bitmap = new BinaryBitmap(new HybridBinarizer(new BufferedImageLuminanceSource(page)));
      Result result = new MultiFormatReader().decode(bitmap);
      assertEquals("https://ourwedding.example/i/no-back-img", result.getText());
    }
  }

  @Test void landscapeSwapsPageDimensions() throws Exception {
    byte[] pdf = renderer.render(theme(Orientation.LANDSCAPE, landscapeSafeLayout()), List.of(new Card("Family", "tok")), 0);
    try (PDDocument doc = Loader.loadPDF(pdf)) {
      for (int i = 0; i < 2; i++) {
        var box = doc.getPage(i).getMediaBox();
        assertEquals(148, Math.round(box.getWidth() / (72f / 25.4f)));
        assertEquals(105, Math.round(box.getHeight() / (72f / 25.4f)));
      }
    }
  }

  @Test void landscapeRejectsAPortraitOnlyYPosition() {
    // 140mm is a valid Y in portrait (max 148) but exceeds landscape's height (max 105).
    TextLayout tooHigh = new TextLayout(52.5f, 140f, 11f, "#000000");
    CardLayout layout = new CardLayout(InvitationCardRenderer.DEFAULT_LAYOUT.qr(), InvitationCardRenderer.DEFAULT_LAYOUT.inviteUrl(), tooHigh);
    CardTheme t = theme(Orientation.LANDSCAPE, layout);
    ApiException ex = assertThrows(ApiException.class, () -> renderer.render(t, List.of(new Card("Family", "tok")), 0));
    assertEquals("INVALID_LAYOUT", ex.code);
  }

  @Test void landscapeQrStillDecodes() throws Exception {
    byte[] pdf = renderer.render(theme(Orientation.LANDSCAPE, landscapeSafeLayout()), List.of(new Card("Family", "landscape-tok")), 0);
    try (PDDocument doc = Loader.loadPDF(pdf)) {
      BufferedImage page = new PDFRenderer(doc).renderImageWithDPI(1, 300);
      BinaryBitmap bitmap = new BinaryBitmap(new HybridBinarizer(new BufferedImageLuminanceSource(page)));
      Result result = new MultiFormatReader().decode(bitmap);
      assertEquals("https://ourwedding.example/i/landscape-tok", result.getText());
    }
  }

  /** DEFAULT_LAYOUT's guestNames.y (108mm) exceeds landscape's 105mm height bound by design --
   * orientation can invalidate saved coordinates (see docs/DECISIONS.md), so landscape tests that
   * aren't specifically about that rejection need their own in-bounds layout. */
  private static CardLayout landscapeSafeLayout() {
    return new CardLayout(
      new QrLayout(52.5f, 52.5f, 40f, "#000000"),
      new TextLayout(52.5f, 25f, 6f, "#737373"),
      new TextLayout(52.5f, 85f, 11f, "#000000"));
  }

  private static boolean closeColor(int a, int b) {
    int ar = (a >> 16) & 0xFF, ag = (a >> 8) & 0xFF, ab = a & 0xFF;
    int br = (b >> 16) & 0xFF, bg = (b >> 8) & 0xFF, bb = b & 0xFF;
    return Math.abs(ar - br) < 20 && Math.abs(ag - bg) < 20 && Math.abs(ab - bb) < 20;
  }

  private static float mmPt(float mm) { return mm * 72f / 25.4f; }

  /** All text on page (1-based, PDFTextStripper convention). */
  private static String pageText(PDDocument doc, int pageOneBased) throws Exception {
    var stripper = new PDFTextStripper();
    stripper.setStartPage(pageOneBased); stripper.setEndPage(pageOneBased);
    return stripper.getText(doc);
  }

  /** Extracts text within a rectangle (mm, top-origin) of the (bleed-less) page. */
  private static String regionText(PDPage page, float xMm, float topMm, float wMm, float hMm) throws Exception {
    var stripper = new PDFTextStripperByArea();
    stripper.addRegion("band", new java.awt.geom.Rectangle2D.Float(mmPt(xMm), mmPt(topMm), mmPt(wMm), mmPt(hMm)));
    stripper.extractRegions(page);
    String text = stripper.getTextForRegion("band");
    return text == null ? "" : text;
  }

  private static byte[] solidJpeg(Color color) throws Exception {
    BufferedImage img = new BufferedImage(200, 200, BufferedImage.TYPE_INT_RGB);
    Graphics2D g = img.createGraphics();
    g.setColor(color);
    g.fillRect(0, 0, 200, 200);
    g.dispose();
    ByteArrayOutputStream out = new ByteArrayOutputStream();
    ImageIO.write(img, "jpg", out);
    return out.toByteArray();
  }
}
