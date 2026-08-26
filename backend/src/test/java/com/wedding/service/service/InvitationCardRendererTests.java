package com.wedding.service.service;

import static org.junit.jupiter.api.Assertions.*;

import com.google.zxing.BinaryBitmap;
import com.google.zxing.MultiFormatReader;
import com.google.zxing.Result;
import com.google.zxing.client.j2se.BufferedImageLuminanceSource;
import com.google.zxing.common.HybridBinarizer;
import com.wedding.service.api.ApiException;
import com.wedding.service.service.InvitationCardRenderer.Card;
import com.wedding.service.service.InvitationCardRenderer.CardTheme;
import java.awt.image.BufferedImage;
import java.util.List;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.rendering.PDFRenderer;
import org.apache.pdfbox.text.PDFTextStripper;
import org.junit.jupiter.api.Test;

/**
 * Plain JUnit 5, no Spring context, no Mockito -- matching JwtServiceTests. InvitationCardRenderer
 * is deliberately a pure function of its inputs so it can be tested this way.
 */
class InvitationCardRendererTests {
  private final InvitationCardRenderer renderer = new InvitationCardRenderer();

  private static CardTheme theme() {
    return new CardTheme("Anjali & Sam", "15 November 2026", "Together with joy", "request the pleasure of your company",
      "Scan to RSVP", null, null, "https://ourwedding.example");
  }

  @Test void rendersOnePagePerCard() throws Exception {
    byte[] pdf = renderer.render(theme(), List.of(new Card("Sharma Family", "tok-one"), new Card("Thapa Family", "tok-two")), 0);
    assertTrue(new String(pdf, 0, 5).startsWith("%PDF"));
    try (PDDocument doc = Loader.loadPDF(pdf)) {
      assertEquals(2, doc.getNumberOfPages());
      String text = new PDFTextStripper().getText(doc);
      assertTrue(text.contains("Sharma Family"));
      assertTrue(text.contains("Thapa Family"));
      assertTrue(text.contains("tok-one"));
      assertTrue(text.contains("tok-two"));
    }
  }

  @Test void qrEncodesTheFullInvitationUrl() throws Exception {
    byte[] pdf = renderer.render(theme(), List.of(new Card("Gurung Family", "abc123-xyz")), 0);
    try (PDDocument doc = Loader.loadPDF(pdf)) {
      BufferedImage page = new PDFRenderer(doc).renderImageWithDPI(0, 300);
      BinaryBitmap bitmap = new BinaryBitmap(new HybridBinarizer(new BufferedImageLuminanceSource(page)));
      Result result = new MultiFormatReader().decode(bitmap);
      assertEquals("https://ourwedding.example/i/abc123-xyz", result.getText());
    }
  }

  @Test void bleedEnlargesThePage() throws Exception {
    byte[] pdf = renderer.render(theme(), List.of(new Card("Family", "tok")), 3);
    try (PDDocument doc = Loader.loadPDF(pdf)) {
      var box = doc.getPage(0).getMediaBox();
      assertEquals(105 + 6, Math.round(box.getWidth() / (72f / 25.4f)));
      assertEquals(148 + 6, Math.round(box.getHeight() / (72f / 25.4f)));
    }
  }

  @Test void rejectsUnprintableCharacters() {
    CardTheme t = theme();
    assertThrows(ApiException.class, () -> renderer.render(t, List.of(new Card("सुन्दर", "tok")), 0));
  }

  @Test void rejectsWebpArtwork() {
    CardTheme t = new CardTheme("A & B", "1 Jan 2027", "", "", "Scan to RSVP", new byte[]{1, 2, 3}, "image/webp", "https://example.com");
    assertThrows(ApiException.class, () -> renderer.render(t, List.of(new Card("Family", "tok")), 0));
  }
}
