import { PDFDocument } from "pdf-lib";
import fs from "fs";
import path from "path";
import sharp from "sharp";

const PDF_PATH = "/Users/mohamedfadlaoui/Downloads/Lettre_deratisation(1)-6-2_260403_110033_260403_110320.pdf";
const OUT_DIR = path.join(process.cwd(), "data", "extracted-sigs");
const DATA_FILE = path.join(process.cwd(), "data", "signatures.json");

// The signataires and their approximate signature regions (y-ranges on each page)
// Manually mapped from the PDF layout
const signataires = [
  // Page 1 table rows (approximate y positions from top, in fraction of page height)
  { id: "pdf01", nom: "Othmane Kadad", appartement: "-", page: 0, hasSignature: false },
  { id: "pdf02", nom: "ABDELAZIZ BELEMLIH", appartement: "S4", page: 0, hasSignature: true },
  { id: "pdf03", nom: "Nabil Lamzabi", appartement: "D9", page: 0, hasSignature: true },
  { id: "pdf04", nom: "brahim bansag", appartement: "-", page: 0, hasSignature: true },
  { id: "pdf05", nom: "anass haial", appartement: "A-5", page: 0, hasSignature: false },
  { id: "pdf06", nom: "Laouni Nacira", appartement: "C-13", page: 0, hasSignature: true },
  { id: "pdf07", nom: "Issam Chrichmi", appartement: "-", page: 0, hasSignature: true },
  { id: "pdf08", nom: "Mehdi HAKIM", appartement: "N5", page: 0, hasSignature: true },
  { id: "pdf09", nom: "Tawfik Khalil", appartement: "I8", page: 0, hasSignature: false },
  { id: "pdf10", nom: "Elyassi sana", appartement: "P4", page: 0, hasSignature: false },
  { id: "pdf11", nom: "Hassan Bellafkih", appartement: "G3", page: 0, hasSignature: true },
  { id: "pdf12", nom: "Meryem Makroune", appartement: "P1", page: 0, hasSignature: true },
  { id: "pdf13", nom: "EL HAKIM HASSAN", appartement: "-", page: 0, hasSignature: true },
  // Page 2
  { id: "pdf14", nom: "Mly Hfid Maliki", appartement: "-", page: 1, hasSignature: true },
  { id: "pdf15", nom: "Ghita Benabdallah", appartement: "S9", page: 1, hasSignature: true },
  { id: "pdf16", nom: "Bekkali Ibtissam", appartement: "S13", page: 1, hasSignature: false },
  { id: "pdf17", nom: "Touizer Zahra", appartement: "J15", page: 1, hasSignature: true },
  { id: "pdf18", nom: "LAMAANI Nejoua", appartement: "H5", page: 1, hasSignature: true },
  { id: "pdf19", nom: "El khoumsi kebir", appartement: "D3", page: 1, hasSignature: true },
];

async function main() {
  // Create output dir
  if (!fs.existsSync(OUT_DIR)) {
    fs.mkdirSync(OUT_DIR, { recursive: true });
  }

  // Load PDF
  const pdfBytes = fs.readFileSync(PDF_PATH);
  const pdfDoc = await PDFDocument.load(pdfBytes);

  // Convert each page to image using sharp (render PDF pages)
  // pdf-lib can't render, so we'll use a different approach:
  // We'll render the PDF pages to images using sips/qlmanage on macOS

  const pages = pdfDoc.getPages();
  console.log(`PDF has ${pages.length} pages`);

  // Use macOS qlmanage to render PDF pages as images
  const { execSync } = await import("child_process");

  // Convert PDF to PNG pages using sips
  const tmpDir = "/tmp/pdf-extract-sigs";
  if (fs.existsSync(tmpDir)) {
    fs.rmSync(tmpDir, { recursive: true });
  }
  fs.mkdirSync(tmpDir, { recursive: true });

  // Use macOS convert via qlmanage for page thumbnails
  // Better approach: use pdftoppm if available, or convert via sips
  try {
    // Try using sips to convert PDF pages
    for (let i = 0; i < pages.length; i++) {
      // Create a single-page PDF for each page
      const singlePageDoc = await PDFDocument.create();
      const [copiedPage] = await singlePageDoc.copyPages(pdfDoc, [i]);
      singlePageDoc.addPage(copiedPage);
      const singlePdfPath = path.join(tmpDir, `page-${i}.pdf`);
      fs.writeFileSync(singlePdfPath, await singlePageDoc.save());

      // Convert to PNG using sips
      const pngPath = path.join(tmpDir, `page-${i}.png`);
      execSync(`sips -s format png "${singlePdfPath}" --out "${pngPath}" -Z 2400 2>/dev/null`, { stdio: "pipe" });
      console.log(`Rendered page ${i} -> ${pngPath}`);
    }
  } catch (e) {
    console.error("Error rendering pages:", e.message);
    process.exit(1);
  }

  // Now extract signature regions from the rendered page images
  // Page 1 signature table starts at roughly 52% from top, right half of table (signature column)
  // Page 2 continues the table from the top

  // Page dimensions from the PDF (in points)
  const page1 = pages[0];
  const pw = page1.getWidth();
  const ph = page1.getHeight();
  console.log(`Page dimensions: ${pw}x${ph} points`);

  // Load rendered images to get pixel dimensions
  const page1Img = sharp(path.join(tmpDir, "page-0.png"));
  const page1Meta = await page1Img.metadata();
  const imgW = page1Meta.width;
  const imgH = page1Meta.height;
  console.log(`Image dimensions: ${imgW}x${imgH} px`);

  // Scale factor
  const scale = imgH / ph;

  // The signature table on page 1:
  // Based on the PDF layout, the table starts at approximately y=490pt from top
  // Each row is about 55-65pt tall
  // The signature column is on the right half (~50% to ~100% of table width)
  // Table spans from about x=48pt to x=562pt

  // Page 1 table: signature column starts at roughly x=305pt (center of table)
  // Table starts at y≈490pt from top

  const tableLeft = 32;   // left edge of table (pts from left)
  const sigColStart = 291; // signature column starts (pts from left)
  const tableRight = 565;  // right edge of table

  // Row Y positions (from TOP of page, in points) - measured from rendered image
  // Page height: 842.25pt, Image: 2400px, scale ≈ 2.849
  // Page 1 rows:
  const page1Rows = [
    { id: "pdf01", yTop: 305, yBot: 354 },    // Othmane Kadad
    { id: "pdf02", yTop: 354, yBot: 400 },    // ABDELAZIZ BELEMLIH
    { id: "pdf03", yTop: 400, yBot: 430 },    // Nabil Lamzabi
    { id: "pdf04", yTop: 430, yBot: 460 },    // brahim bansag
    { id: "pdf05", yTop: 460, yBot: 481 },    // anass haial
    { id: "pdf06", yTop: 481, yBot: 512 },    // Laouni Nacira
    { id: "pdf07", yTop: 512, yBot: 545 },    // Issam Chrichmi
    { id: "pdf08", yTop: 545, yBot: 583 },    // Mehdi HAKIM
    { id: "pdf09", yTop: 583, yBot: 614 },    // Tawfik Khalil
    { id: "pdf10", yTop: 614, yBot: 641 },    // Elyassi sana
    { id: "pdf11", yTop: 641, yBot: 694 },    // Hassan Bellafkih
    { id: "pdf12", yTop: 694, yBot: 745 },    // Meryem Makroune
    { id: "pdf13", yTop: 745, yBot: 795 },    // EL HAKIM HASSAN
  ];

  const page2Rows = [
    { id: "pdf14", yTop: 0, yBot: 80 },       // Mly Hfid Maliki
    { id: "pdf15", yTop: 80, yBot: 150 },     // Ghita Benabdallah
    { id: "pdf16", yTop: 150, yBot: 195 },    // Bekkali Ibtissam
    { id: "pdf17", yTop: 195, yBot: 270 },    // Touizer Zahra
    { id: "pdf18", yTop: 270, yBot: 330 },    // LAMAANI Nejoua
    { id: "pdf19", yTop: 330, yBot: 420 },    // El khoumsi kebir
  ];

  // Extract signatures from page images
  async function extractSig(pageIndex, row) {
    const imgPath = path.join(tmpDir, `page-${pageIndex}.png`);
    const meta = await sharp(imgPath).metadata();
    const s = meta.height / pages[pageIndex].getHeight();

    const left = Math.round(sigColStart * s);
    const top = Math.round(row.yTop * s);
    const width = Math.round((tableRight - sigColStart) * s);
    const height = Math.round((row.yBot - row.yTop) * s);

    // Clamp values
    const clampedLeft = Math.max(0, Math.min(left, meta.width - 1));
    const clampedTop = Math.max(0, Math.min(top, meta.height - 1));
    const clampedWidth = Math.min(width, meta.width - clampedLeft);
    const clampedHeight = Math.min(height, meta.height - clampedTop);

    if (clampedWidth <= 0 || clampedHeight <= 0) {
      console.log(`  Skipping ${row.id}: invalid dimensions`);
      return null;
    }

    const outPath = path.join(OUT_DIR, `${row.id}.png`);

    await sharp(imgPath)
      .extract({ left: clampedLeft, top: clampedTop, width: clampedWidth, height: clampedHeight })
      .png()
      .toFile(outPath);

    // Convert to data URL
    const imgBuf = fs.readFileSync(outPath);
    const dataUrl = `data:image/png;base64,${imgBuf.toString("base64")}`;

    console.log(`  Extracted ${row.id} (${clampedWidth}x${clampedHeight})`);
    return dataUrl;
  }

  // Process all rows
  const sigMap = {};

  console.log("\nExtracting page 1 signatures...");
  for (const row of page1Rows) {
    const dataUrl = await extractSig(0, row);
    if (dataUrl) sigMap[row.id] = dataUrl;
  }

  console.log("\nExtracting page 2 signatures...");
  for (const row of page2Rows) {
    const dataUrl = await extractSig(1, row);
    if (dataUrl) sigMap[row.id] = dataUrl;
  }

  // Update signatures.json
  const entries = JSON.parse(fs.readFileSync(DATA_FILE, "utf-8"));
  let updated = 0;

  for (const entry of entries) {
    if (sigMap[entry.id]) {
      const sig = signataires.find(s => s.id === entry.id);
      if (sig && sig.hasSignature) {
        entry.signatureData = sigMap[entry.id];
        updated++;
      }
    }
  }

  fs.writeFileSync(DATA_FILE, JSON.stringify(entries, null, 2), "utf-8");
  console.log(`\nUpdated ${updated} signatures in ${DATA_FILE}`);

  // Cleanup
  fs.rmSync(tmpDir, { recursive: true });
  console.log("Done!");
}

main().catch(console.error);
