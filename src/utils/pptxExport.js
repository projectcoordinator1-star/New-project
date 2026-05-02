const EMU_PER_INCH = 914400;
const SLIDE_WIDTH = 10 * EMU_PER_INCH;
const SLIDE_HEIGHT = 5.625 * EMU_PER_INCH;
const REL_NS = "http://schemas.openxmlformats.org/package/2006/relationships";
const OFFICE_REL_NS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const PRESENTATION_NS = "http://schemas.openxmlformats.org/presentationml/2006/main";
const DRAWING_NS = "http://schemas.openxmlformats.org/drawingml/2006/main";
const PACKAGE_REL_NS = "http://schemas.openxmlformats.org/package/2006/relationships";

const IMAGE_EXTENSION_BY_MIME = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
};

const IMAGE_CONTENT_TYPE_BY_EXTENSION = {
  jpeg: "image/jpeg",
  jpg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
};

function xmlEscape(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function safeText(value, fallback = "--") {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function getStoreLabel(store) {
  const storeName = safeText(store.storeName, "Unnamed Store");
  const storeId = safeText(store.storeId, "No Store ID");
  return `${storeId} - ${storeName}`;
}

function normalizeImageList(images, legacyAsset) {
  const list = Array.isArray(images) ? images.filter((image) => image?.dataUrl) : [];
  if (legacyAsset?.dataUrl && !list.some((image) => image.dataUrl === legacyAsset.dataUrl)) {
    return [legacyAsset, ...list];
  }

  return list;
}

function normalizeEvidence(evidence = {}) {
  return {
    beforeImages: normalizeImageList(evidence.beforeImages, evidence.before),
    afterImages: normalizeImageList(evidence.afterImages, evidence.after),
  };
}

function formatDateTime(value) {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";
  return date.toLocaleString();
}

function dataUrlToImagePart(dataUrl, imageIndex) {
  const match = String(dataUrl || "").match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;

  const mimeType = match[1].toLowerCase();
  const extension = IMAGE_EXTENSION_BY_MIME[mimeType] || "png";
  const binary = atob(match[2]);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return {
    bytes,
    extension,
    contentType: IMAGE_CONTENT_TYPE_BY_EXTENSION[extension] || mimeType,
    path: `ppt/media/image${imageIndex}.${extension}`,
  };
}

function getDosDateTime(date = new Date()) {
  const year = Math.max(date.getFullYear(), 1980);
  const dosTime = (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2);
  const dosDate = ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  return { dosDate, dosTime };
}

function makeCrcTable() {
  return Array.from({ length: 256 }, (_, tableIndex) => {
    let value = tableIndex;
    for (let bit = 0; bit < 8; bit += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    return value >>> 0;
  });
}

const CRC_TABLE = makeCrcTable();

function crc32(bytes) {
  let crc = 0xffffffff;
  for (let index = 0; index < bytes.length; index += 1) {
    crc = CRC_TABLE[(crc ^ bytes[index]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function writeUint16(view, offset, value) {
  view.setUint16(offset, value, true);
  return offset + 2;
}

function writeUint32(view, offset, value) {
  view.setUint32(offset, value >>> 0, true);
  return offset + 4;
}

function concatBytes(parts) {
  const totalLength = parts.reduce((sum, part) => sum + part.length, 0);
  const output = new Uint8Array(totalLength);
  let offset = 0;

  parts.forEach((part) => {
    output.set(part, offset);
    offset += part.length;
  });

  return output;
}

function toBytes(content) {
  if (content instanceof Uint8Array) return content;
  return new TextEncoder().encode(content);
}

function buildZip(entries) {
  const encodedEntries = entries.map((entry) => ({
    name: entry.path,
    nameBytes: new TextEncoder().encode(entry.path),
    bytes: toBytes(entry.content),
  }));
  const { dosDate, dosTime } = getDosDateTime();
  const localParts = [];
  const centralParts = [];
  let offset = 0;

  encodedEntries.forEach((entry) => {
    const crc = crc32(entry.bytes);
    const localHeader = new Uint8Array(30 + entry.nameBytes.length);
    const localView = new DataView(localHeader.buffer);
    let localOffset = 0;
    localOffset = writeUint32(localView, localOffset, 0x04034b50);
    localOffset = writeUint16(localView, localOffset, 20);
    localOffset = writeUint16(localView, localOffset, 0);
    localOffset = writeUint16(localView, localOffset, 0);
    localOffset = writeUint16(localView, localOffset, dosTime);
    localOffset = writeUint16(localView, localOffset, dosDate);
    localOffset = writeUint32(localView, localOffset, crc);
    localOffset = writeUint32(localView, localOffset, entry.bytes.length);
    localOffset = writeUint32(localView, localOffset, entry.bytes.length);
    localOffset = writeUint16(localView, localOffset, entry.nameBytes.length);
    localOffset = writeUint16(localView, localOffset, 0);
    localHeader.set(entry.nameBytes, localOffset);

    localParts.push(localHeader, entry.bytes);

    const centralHeader = new Uint8Array(46 + entry.nameBytes.length);
    const centralView = new DataView(centralHeader.buffer);
    let centralOffset = 0;
    centralOffset = writeUint32(centralView, centralOffset, 0x02014b50);
    centralOffset = writeUint16(centralView, centralOffset, 20);
    centralOffset = writeUint16(centralView, centralOffset, 20);
    centralOffset = writeUint16(centralView, centralOffset, 0);
    centralOffset = writeUint16(centralView, centralOffset, 0);
    centralOffset = writeUint16(centralView, centralOffset, dosTime);
    centralOffset = writeUint16(centralView, centralOffset, dosDate);
    centralOffset = writeUint32(centralView, centralOffset, crc);
    centralOffset = writeUint32(centralView, centralOffset, entry.bytes.length);
    centralOffset = writeUint32(centralView, centralOffset, entry.bytes.length);
    centralOffset = writeUint16(centralView, centralOffset, entry.nameBytes.length);
    centralOffset = writeUint16(centralView, centralOffset, 0);
    centralOffset = writeUint16(centralView, centralOffset, 0);
    centralOffset = writeUint16(centralView, centralOffset, 0);
    centralOffset = writeUint16(centralView, centralOffset, 0);
    centralOffset = writeUint32(centralView, centralOffset, 0);
    centralOffset = writeUint32(centralView, centralOffset, offset);
    centralHeader.set(entry.nameBytes, centralOffset);

    centralParts.push(centralHeader);
    offset += localHeader.length + entry.bytes.length;
  });

  const centralDirectory = concatBytes(centralParts);
  const endRecord = new Uint8Array(22);
  const endView = new DataView(endRecord.buffer);
  let endOffset = 0;
  endOffset = writeUint32(endView, endOffset, 0x06054b50);
  endOffset = writeUint16(endView, endOffset, 0);
  endOffset = writeUint16(endView, endOffset, 0);
  endOffset = writeUint16(endView, endOffset, encodedEntries.length);
  endOffset = writeUint16(endView, endOffset, encodedEntries.length);
  endOffset = writeUint32(endView, endOffset, centralDirectory.length);
  endOffset = writeUint32(endView, endOffset, offset);
  writeUint16(endView, endOffset, 0);

  return new Blob([...localParts, centralDirectory, endRecord], {
    type: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  });
}

function relsXml(relationships) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="${REL_NS}">
${relationships
  .map((relationship) => `<Relationship Id="${relationship.id}" Type="${relationship.type}" Target="${relationship.target}"/>`)
  .join("")}
</Relationships>`;
}

function textRun(text, options = {}) {
  const size = options.size || 1200;
  const color = options.color || "173252";
  const bold = options.bold ? ' b="1"' : "";

  return `<a:r><a:rPr lang="en-US" sz="${size}"${bold}><a:solidFill><a:srgbClr val="${color}"/></a:solidFill><a:latin typeface="Aptos"/></a:rPr><a:t>${xmlEscape(text)}</a:t></a:r>`;
}

function textShape(id, name, x, y, cx, cy, lines, options = {}) {
  const paragraphs = (Array.isArray(lines) ? lines : [lines]).map((line) => {
    const text = typeof line === "object" ? line.text : line;
    const lineOptions = typeof line === "object" ? { ...options, ...line } : options;
    return `<a:p><a:pPr algn="${lineOptions.align || "l"}"/>${textRun(text, lineOptions)}<a:endParaRPr lang="en-US"/></a:p>`;
  });

  return `<p:sp>
<p:nvSpPr><p:cNvPr id="${id}" name="${xmlEscape(name)}"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr>
<p:spPr><a:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/><a:ln><a:noFill/></a:ln></p:spPr>
<p:txBody><a:bodyPr wrap="square" lIns="0" tIns="0" rIns="0" bIns="0"><a:spAutoFit/></a:bodyPr><a:lstStyle/>${paragraphs.join("")}</p:txBody>
</p:sp>`;
}

function rectShape(id, name, x, y, cx, cy, options = {}) {
  const fill = options.fill || "FFFFFF";
  const line = options.line || "D7E6F4";

  return `<p:sp>
<p:nvSpPr><p:cNvPr id="${id}" name="${xmlEscape(name)}"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>
<p:spPr><a:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="${options.shape || "roundRect"}"><a:avLst/></a:prstGeom><a:solidFill><a:srgbClr val="${fill}"/></a:solidFill><a:ln w="12700"><a:solidFill><a:srgbClr val="${line}"/></a:solidFill></a:ln></p:spPr>
</p:sp>`;
}

function pictureShape(id, name, relId, x, y, cx, cy) {
  return `<p:pic>
<p:nvPicPr><p:cNvPr id="${id}" name="${xmlEscape(name)}"/><p:cNvPicPr><a:picLocks noChangeAspect="1"/></p:cNvPicPr><p:nvPr/></p:nvPicPr>
<p:blipFill><a:blip r:embed="${relId}"/><a:stretch><a:fillRect/></a:stretch></p:blipFill>
<p:spPr><a:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr>
</p:pic>`;
}

function photoCardXml(ctx, title, asset, relId, x, y, cx, cy) {
  const titleHeight = 240000;
  const captionHeight = 180000;
  const padding = 90000;
  const imageY = y + titleHeight + padding;
  const imageHeight = cy - titleHeight - captionHeight - padding * 2;
  const imageX = x + padding;
  const imageWidth = cx - padding * 2;
  const parts = [
    rectShape(ctx.nextId(), `${title} Card`, x, y, cx, cy),
    textShape(ctx.nextId(), `${title} Title`, x + padding, y + 115000, imageWidth, titleHeight, title, {
      bold: true,
      color: "173252",
      size: 1400,
    }),
  ];

  if (asset?.dataUrl && relId) {
    parts.push(pictureShape(ctx.nextId(), title, relId, imageX, imageY, imageWidth, imageHeight));
    parts.push(
      textShape(
        ctx.nextId(),
        `${title} Caption`,
        imageX,
        y + cy - captionHeight,
        imageWidth,
        captionHeight,
        formatDateTime(asset.updatedAt),
        { color: "6C819A", size: 800 },
      ),
    );
  } else {
    parts.push(rectShape(ctx.nextId(), `${title} Empty`, imageX, imageY, imageWidth, imageHeight, { fill: "F5F9FD", line: "BFD1E5" }));
    parts.push(
      textShape(ctx.nextId(), `${title} Missing`, imageX, imageY + imageHeight / 2 - 90000, imageWidth, 180000, "No image uploaded", {
        align: "ctr",
        color: "7890AA",
        size: 1200,
      }),
    );
  }

  return parts.join("");
}

function buildSlideXml(slide) {
  let shapeId = 2;
  const ctx = {
    nextId: () => {
      const current = shapeId;
      shapeId += 1;
      return current;
    },
  };
  const margin = 320000;
  const gap = 180000;
  const cardWidth = (SLIDE_WIDTH - margin * 2 - gap) / 2;
  const cardY = 1420000;
  const cardHeight = 3380000;

  const shapes = [
    textShape(ctx.nextId(), "Report Title", 380000, 330000, 3500000, 220000, "Deep Cleaning", {
      bold: true,
      color: "2877A8",
      size: 1000,
    }),
    textShape(ctx.nextId(), "Vendor", 380000, 550000, 3500000, 220000, "Vendor: QPMS", {
      bold: true,
      color: "5D7390",
      size: 950,
    }),
    textShape(ctx.nextId(), "Store Title", 380000, 780000, 7200000, 400000, getStoreLabel(slide.store), {
      bold: true,
      color: "173252",
      size: 2400,
    }),
    textShape(ctx.nextId(), "Store Subtitle", 380000, 1160000, 7200000, 220000, `${safeText(slide.store.location)} | ${safeText(slide.store.region)}`, {
      color: "5D7390",
      size: 1100,
    }),
  ];

  shapes.push(photoCardXml(ctx, "Before", slide.beforeImage, slide.beforeRelId, margin, cardY, cardWidth, cardHeight));
  shapes.push(
    photoCardXml(ctx, "After", slide.afterImage, slide.afterRelId, margin + cardWidth + gap, cardY, cardWidth, cardHeight),
  );
  shapes.push(
    textShape(
      ctx.nextId(),
      "Footer",
      margin,
      4840000,
      SLIDE_WIDTH - margin * 2,
      160000,
      `Photo set ${slide.imageIndex + 1} of ${slide.slideCount} | Generated ${slide.generatedAt}`,
      { align: "r", color: "7890AA", size: 800 },
    ),
  );

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="${DRAWING_NS}" xmlns:r="${OFFICE_REL_NS}" xmlns:p="${PRESENTATION_NS}">
<p:cSld><p:bg><p:bgPr><a:solidFill><a:srgbClr val="F8FCFF"/></a:solidFill><a:effectLst/></p:bgPr></p:bg><p:spTree>
<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
<p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>
${shapes.join("")}
</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>
</p:sld>`;
}

function buildSlideRels(slide) {
  const relationships = [{ id: "rId1", type: `${OFFICE_REL_NS}/slideLayout`, target: "../slideLayouts/slideLayout1.xml" }];
  let relIndex = 2;

  if (slide.beforeImagePart) {
    slide.beforeRelId = `rId${relIndex}`;
    relIndex += 1;
    relationships.push({ id: slide.beforeRelId, type: `${OFFICE_REL_NS}/image`, target: `../media/${slide.beforeImagePart.path.split("/").pop()}` });
  }

  if (slide.afterImagePart) {
    slide.afterRelId = `rId${relIndex}`;
    relationships.push({ id: slide.afterRelId, type: `${OFFICE_REL_NS}/image`, target: `../media/${slide.afterImagePart.path.split("/").pop()}` });
  }

  return relsXml(relationships);
}

function buildThemeXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<a:theme xmlns:a="${DRAWING_NS}" name="QPMS Theme"><a:themeElements><a:clrScheme name="QPMS">
<a:dk1><a:srgbClr val="173252"/></a:dk1><a:lt1><a:srgbClr val="FFFFFF"/></a:lt1><a:dk2><a:srgbClr val="1F4E79"/></a:dk2><a:lt2><a:srgbClr val="F8FCFF"/></a:lt2>
<a:accent1><a:srgbClr val="2877A8"/></a:accent1><a:accent2><a:srgbClr val="5DBDDD"/></a:accent2><a:accent3><a:srgbClr val="1E8E5A"/></a:accent3><a:accent4><a:srgbClr val="F0A33A"/></a:accent4><a:accent5><a:srgbClr val="B42318"/></a:accent5><a:accent6><a:srgbClr val="7890AA"/></a:accent6>
<a:hlink><a:srgbClr val="2877A8"/></a:hlink><a:folHlink><a:srgbClr val="5D7390"/></a:folHlink></a:clrScheme>
<a:fontScheme name="Aptos"><a:majorFont><a:latin typeface="Aptos Display"/><a:ea typeface=""/><a:cs typeface=""/></a:majorFont><a:minorFont><a:latin typeface="Aptos"/><a:ea typeface=""/><a:cs typeface=""/></a:minorFont></a:fontScheme>
<a:fmtScheme name="QPMS">
<a:fillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:gradFill rotWithShape="1"><a:gsLst><a:gs pos="0"><a:schemeClr val="phClr"><a:lumMod val="110000"/><a:satMod val="105000"/></a:schemeClr></a:gs><a:gs pos="100000"><a:schemeClr val="phClr"><a:lumMod val="93000"/><a:satMod val="105000"/></a:schemeClr></a:gs></a:gsLst><a:lin ang="5400000" scaled="0"/></a:gradFill><a:gradFill rotWithShape="1"><a:gsLst><a:gs pos="0"><a:schemeClr val="phClr"><a:lumMod val="102000"/><a:satMod val="103000"/></a:schemeClr></a:gs><a:gs pos="100000"><a:schemeClr val="phClr"><a:lumMod val="90000"/><a:satMod val="110000"/></a:schemeClr></a:gs></a:gsLst><a:lin ang="5400000" scaled="0"/></a:gradFill></a:fillStyleLst>
<a:lnStyleLst><a:ln w="6350" cap="flat" cmpd="sng" algn="ctr"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:prstDash val="solid"/></a:ln><a:ln w="12700" cap="flat" cmpd="sng" algn="ctr"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:prstDash val="solid"/></a:ln><a:ln w="19050" cap="flat" cmpd="sng" algn="ctr"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:prstDash val="solid"/></a:ln></a:lnStyleLst>
<a:effectStyleLst><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst><a:outerShdw blurRad="40000" dist="20000" dir="5400000" rotWithShape="0"><a:srgbClr val="000000"><a:alpha val="20000"/></a:srgbClr></a:outerShdw></a:effectLst></a:effectStyle><a:effectStyle><a:effectLst><a:outerShdw blurRad="57150" dist="38100" dir="5400000" rotWithShape="0"><a:srgbClr val="000000"><a:alpha val="25000"/></a:srgbClr></a:outerShdw></a:effectLst></a:effectStyle></a:effectStyleLst>
<a:bgFillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"><a:tint val="95000"/></a:schemeClr></a:solidFill><a:gradFill rotWithShape="1"><a:gsLst><a:gs pos="0"><a:schemeClr val="phClr"/></a:gs><a:gs pos="100000"><a:schemeClr val="phClr"><a:lumMod val="85000"/></a:schemeClr></a:gs></a:gsLst><a:lin ang="5400000" scaled="0"/></a:gradFill></a:bgFillStyleLst>
</a:fmtScheme>
</a:themeElements><a:objectDefaults/><a:extraClrSchemeLst/></a:theme>`;
}

function buildSlideMasterXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sldMaster xmlns:a="${DRAWING_NS}" xmlns:r="${OFFICE_REL_NS}" xmlns:p="${PRESENTATION_NS}">
<p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr></p:spTree></p:cSld>
<p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/>
<p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst>
<p:txStyles><p:titleStyle/><p:bodyStyle/><p:otherStyle/></p:txStyles>
</p:sldMaster>`;
}

function buildSlideLayoutXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sldLayout xmlns:a="${DRAWING_NS}" xmlns:r="${OFFICE_REL_NS}" xmlns:p="${PRESENTATION_NS}" type="blank" preserve="1">
<p:cSld name="Blank"><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr></p:spTree></p:cSld>
<p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sldLayout>`;
}

function buildPresentationXml(slideCount) {
  const slideIds = Array.from({ length: slideCount }, (_, index) => `<p:sldId id="${256 + index}" r:id="rId${index + 2}"/>`).join("");

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:presentation xmlns:a="${DRAWING_NS}" xmlns:r="${OFFICE_REL_NS}" xmlns:p="${PRESENTATION_NS}">
<p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst>
<p:sldIdLst>${slideIds}</p:sldIdLst>
<p:sldSz cx="${SLIDE_WIDTH}" cy="${SLIDE_HEIGHT}" type="screen16x9"/><p:notesSz cx="6858000" cy="9144000"/>
<p:defaultTextStyle><a:defPPr><a:defRPr lang="en-US"/></a:defPPr></p:defaultTextStyle>
</p:presentation>`;
}

function buildPresentationRels(slideCount) {
  const relationships = [
    { id: "rId1", type: `${OFFICE_REL_NS}/slideMaster`, target: "slideMasters/slideMaster1.xml" },
    ...Array.from({ length: slideCount }, (_, index) => ({
      id: `rId${index + 2}`,
      type: `${OFFICE_REL_NS}/slide`,
      target: `slides/slide${index + 1}.xml`,
    })),
  ];

  return relsXml(relationships);
}

function buildContentTypesXml(slideCount, imageExtensions) {
  const imageDefaults = [...new Set(imageExtensions)]
    .map((extension) => `<Default Extension="${extension}" ContentType="${IMAGE_CONTENT_TYPE_BY_EXTENSION[extension] || "image/png"}"/>`)
    .join("");
  const slideOverrides = Array.from(
    { length: slideCount },
    (_, index) =>
      `<Override PartName="/ppt/slides/slide${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`,
  ).join("");

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
${imageDefaults}
<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
<Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>
<Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>
<Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/>
<Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/>
${slideOverrides}
</Types>`;
}

function buildCoreXml(generatedIso) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
<dc:title>Deep Cleaning</dc:title><dc:creator>QPMS Operations Dashboard</dc:creator><cp:lastModifiedBy>QPMS Operations Dashboard</cp:lastModifiedBy>
<dcterms:created xsi:type="dcterms:W3CDTF">${generatedIso}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${generatedIso}</dcterms:modified>
</cp:coreProperties>`;
}

function buildAppXml(slideCount) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">
<Application>QPMS Operations Dashboard</Application><PresentationFormat>Widescreen</PresentationFormat><Slides>${slideCount}</Slides><Notes>0</Notes><HiddenSlides>0</HiddenSlides><MMClips>0</MMClips><ScaleCrop>false</ScaleCrop><Company></Company><LinksUpToDate>false</LinksUpToDate><SharedDoc>false</SharedDoc><HyperlinksChanged>false</HyperlinksChanged><AppVersion>16.0000</AppVersion>
</Properties>`;
}

function createSlides(reportStores, generatedAt) {
  const slides = [];
  const imageEntries = [];
  let imageIndex = 1;

  reportStores.forEach(({ store, evidence }) => {
    const normalizedEvidence = normalizeEvidence(evidence);
    const beforeImages = normalizedEvidence.beforeImages;
    const afterImages = normalizedEvidence.afterImages;
    const slideCount = Math.max(beforeImages.length, afterImages.length, 1);

    for (let index = 0; index < slideCount; index += 1) {
      const beforeImage = beforeImages[index] || null;
      const afterImage = afterImages[index] || null;
      const slide = {
        store,
        beforeImage,
        afterImage,
        imageIndex: index,
        slideCount,
        generatedAt,
      };

      if (beforeImage?.dataUrl) {
        slide.beforeImagePart = dataUrlToImagePart(beforeImage.dataUrl, imageIndex);
        if (slide.beforeImagePart) {
          imageEntries.push(slide.beforeImagePart);
          imageIndex += 1;
        }
      }

      if (afterImage?.dataUrl) {
        slide.afterImagePart = dataUrlToImagePart(afterImage.dataUrl, imageIndex);
        if (slide.afterImagePart) {
          imageEntries.push(slide.afterImagePart);
          imageIndex += 1;
        }
      }

      slides.push(slide);
    }
  });

  return { imageEntries, slides };
}

export function buildDeepCleaningPptx(reportStores) {
  const generatedDate = new Date();
  const generatedAt = generatedDate.toLocaleString();
  const { imageEntries, slides } = createSlides(reportStores, generatedAt);
  const slideCount = Math.max(slides.length, 1);
  const generatedIso = generatedDate.toISOString();
  const entries = [
    { path: "[Content_Types].xml", content: buildContentTypesXml(slideCount, imageEntries.map((entry) => entry.extension)) },
    {
      path: "_rels/.rels",
      content: relsXml([
        { id: "rId1", type: `${OFFICE_REL_NS}/officeDocument`, target: "ppt/presentation.xml" },
        { id: "rId2", type: `${PACKAGE_REL_NS}/metadata/core-properties`, target: "docProps/core.xml" },
        { id: "rId3", type: `${OFFICE_REL_NS}/extended-properties`, target: "docProps/app.xml" },
      ]),
    },
    { path: "docProps/core.xml", content: buildCoreXml(generatedIso) },
    { path: "docProps/app.xml", content: buildAppXml(slideCount) },
    { path: "ppt/presentation.xml", content: buildPresentationXml(slideCount) },
    { path: "ppt/_rels/presentation.xml.rels", content: buildPresentationRels(slideCount) },
    { path: "ppt/theme/theme1.xml", content: buildThemeXml() },
    { path: "ppt/slideMasters/slideMaster1.xml", content: buildSlideMasterXml() },
    {
      path: "ppt/slideMasters/_rels/slideMaster1.xml.rels",
      content: relsXml([
        { id: "rId1", type: `${OFFICE_REL_NS}/slideLayout`, target: "../slideLayouts/slideLayout1.xml" },
        { id: "rId2", type: `${OFFICE_REL_NS}/theme`, target: "../theme/theme1.xml" },
      ]),
    },
    { path: "ppt/slideLayouts/slideLayout1.xml", content: buildSlideLayoutXml() },
    {
      path: "ppt/slideLayouts/_rels/slideLayout1.xml.rels",
      content: relsXml([{ id: "rId1", type: `${OFFICE_REL_NS}/slideMaster`, target: "../slideMasters/slideMaster1.xml" }]),
    },
  ];

  slides.forEach((slide, index) => {
    const rels = buildSlideRels(slide);
    entries.push({ path: `ppt/slides/slide${index + 1}.xml`, content: buildSlideXml(slide) });
    entries.push({ path: `ppt/slides/_rels/slide${index + 1}.xml.rels`, content: rels });
  });

  imageEntries.forEach((imageEntry) => {
    entries.push({ path: imageEntry.path, content: imageEntry.bytes });
  });

  return buildZip(entries);
}
