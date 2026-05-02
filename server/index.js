import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { loadLocalEnv } from "./env.js";
import { createPool, importWorkbookToRawDb } from "./db/rawImport.js";
import { fetchDashboardBootstrap, fetchReportFilterOptions, fetchReportRows, getReportCatalog } from "./db/appViews.js";
import {
  createDeepCleaningEvidence,
  deleteDeepCleaningEvidence,
  ensureDeepCleaningEvidenceSchema,
  fetchDeepCleaningEvidence,
} from "./db/deepCleaningEvidence.js";
import { createMasterStore, updateMasterStoreStatus } from "./db/masterStores.js";
import { updateFaultStatus, ensureFaultUpdatesSchema } from "./db/faults.js";
import {
  createTrainingEvidence,
  deleteTrainingEvidence,
  ensureTrainingSchema,
  fetchTrainingEvidence,
  fetchTrainingFormOptions,
} from "./db/training.js";

loadLocalEnv();

const PORT = Number(process.env.QPMS_DB_API_PORT || 8787);
const pool = createPool();

const TRAINING_UPLOAD_DIR = path.resolve(process.cwd(), "uploads/training");
const DEEP_CLEANING_UPLOAD_DIR = path.resolve(process.cwd(), "uploads/deep-cleaning");

for (const uploadDir of [TRAINING_UPLOAD_DIR, DEEP_CLEANING_UPLOAD_DIR]) {
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }
}

ensureTrainingSchema(pool).catch((error) => {
  console.warn("Unable to prepare technical training schema:", error.message);
});

ensureDeepCleaningEvidenceSchema(pool).catch((error) => {
  console.warn("Unable to prepare deep cleaning evidence schema:", error.message);
});

ensureFaultUpdatesSchema(pool).catch((error) => {
  console.warn("Unable to prepare fault status updates schema:", error.message);
});

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET,POST,PATCH,DELETE,OPTIONS",
    "access-control-allow-headers": "content-type",
  });
  response.end(JSON.stringify(payload));
}

async function readJsonBody(request) {
  const chunks = [];
  for await (const chunk of request) {
    chunks.push(chunk);
  }
  const rawBody = Buffer.concat(chunks).toString("utf8");
  return rawBody ? JSON.parse(rawBody) : {};
}

// Very simple multipart parser for this specific use case
async function parseMultipart(request, uploadDir = TRAINING_UPLOAD_DIR, uploadPathPrefix = "/uploads/training") {
  const chunks = [];
  for await (const chunk of request) {
    chunks.push(chunk);
  }
  const body = Buffer.concat(chunks);
  const contentType = request.headers["content-type"];
  const boundary = "--" + contentType.split("boundary=")[1];
  
  const parts = [];
  let start = 0;
  while (true) {
    const boundaryIndex = body.indexOf(boundary, start);
    if (boundaryIndex === -1) break;
    
    const nextBoundaryIndex = body.indexOf(boundary, boundaryIndex + boundary.length);
    if (nextBoundaryIndex === -1) break;
    
    const part = body.slice(boundaryIndex + boundary.length, nextBoundaryIndex);
    const headerEndIndex = part.indexOf("\r\n\r\n");
    const headerStr = part.slice(0, headerEndIndex).toString();
    const content = part.slice(headerEndIndex + 4, part.length - 2); // -2 to remove \r\n
    
    const nameMatch = headerStr.match(/name="([^"]+)"/);
    const filenameMatch = headerStr.match(/filename="([^"]+)"/);
    
    parts.push({
      name: nameMatch ? nameMatch[1] : null,
      filename: filenameMatch ? filenameMatch[1] : null,
      content: content,
      contentType: headerStr.match(/Content-Type: ([^\r\n]+)/)?.[1] || null
    });
    
    start = nextBoundaryIndex;
  }
  
  const result = {};
  for (const part of parts) {
    if (part.filename) {
      const ext = path.extname(part.filename);
      const filename = `image-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
      const filepath = path.join(uploadDir, filename);
      fs.writeFileSync(filepath, part.content);
      const filePayload = { filename, path: `${uploadPathPrefix}/${filename}` };
      if (result[part.name]) {
        result[part.name] = Array.isArray(result[part.name]) ? [...result[part.name], filePayload] : [result[part.name], filePayload];
      } else {
        result[part.name] = filePayload;
      }
    } else {
      result[part.name] = part.content.toString();
    }
  }
  return result;
}

function getTrainingImageDataUrl(imagePath) {
  const cleanPath = String(imagePath || "").replace(/^[/\\]+/, "");
  const absolutePath = path.resolve(process.cwd(), cleanPath);
  const uploadsRoot = path.resolve(process.cwd(), "uploads");

  if (!absolutePath.startsWith(uploadsRoot)) {
    const error = new Error("Invalid training image path");
    error.statusCode = 400;
    throw error;
  }

  if (!fs.existsSync(absolutePath)) {
    const error = new Error("Training image file not found");
    error.statusCode = 404;
    throw error;
  }

  const ext = path.extname(absolutePath).toLowerCase();
  const mimeTypes = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".gif": "image/gif",
    ".webp": "image/webp",
  };
  const mimeType = mimeTypes[ext] || "application/octet-stream";
  const data = fs.readFileSync(absolutePath).toString("base64");

  return `data:${mimeType};base64,${data}`;
}

function removeUploadedFiles(imagePaths = []) {
  imagePaths.filter(Boolean).forEach((imagePath) => {
    const physicalPath = path.join(process.cwd(), imagePath);
    if (fs.existsSync(physicalPath)) {
      fs.unlinkSync(physicalPath);
    }
  });
}

const server = http.createServer(async (request, response) => {
  const requestUrl = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`);
  const pathname = requestUrl.pathname;

  if (request.method === "OPTIONS") {
    sendJson(response, 204, {});
    return;
  }

  // Static file serving for uploads
  if (request.method === "GET" && pathname.startsWith("/uploads/")) {
    const filePath = path.join(process.cwd(), pathname);
    if (fs.existsSync(filePath)) {
      const ext = path.extname(filePath).toLowerCase();
      const mimeTypes = {
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
        ".gif": "image/gif",
        ".webp": "image/webp",
      };
      response.writeHead(200, {
        "Content-Type": mimeTypes[ext] || "application/octet-stream",
        "access-control-allow-origin": "*",
      });
      fs.createReadStream(filePath).pipe(response);
    } else {
      sendJson(response, 404, { ok: false, error: "File not found" });
    }
    return;
  }

  try {
    if (request.method === "GET" && pathname === "/api/health") {
      await pool.query("select 1");
      sendJson(response, 200, {
        ok: true,
        database: process.env.PGDATABASE || "qpms_dashboard",
      });
      return;
    }

    if (request.method === "GET" && pathname === "/api/dashboard/bootstrap") {
      const result = await fetchDashboardBootstrap(pool);
      sendJson(response, 200, result);
      return;
    }

    if (request.method === "GET" && pathname === "/api/reports") {
      sendJson(response, 200, {
        ok: true,
        reports: getReportCatalog(),
      });
      return;
    }

    if (request.method === "GET" && pathname.startsWith("/api/reports/")) {
      const [, reportKey, action] = pathname.match(/^\/api\/reports\/([^/]+)(?:\/([^/]+))?$/) || [];
      if (reportKey && action === "options") {
        const result = await fetchReportFilterOptions(pool, reportKey);
        sendJson(response, 200, result);
        return;
      }
      if (reportKey && !action) {
        const result = await fetchReportRows(pool, reportKey, requestUrl.searchParams);
        sendJson(response, 200, result);
        return;
      }
    }

    if (request.method === "POST" && pathname === "/api/master/stores") {
      const payload = await readJsonBody(request);
      const result = await createMasterStore(pool, payload);
      sendJson(response, 201, result);
      return;
    }

    if (request.method === "PATCH" && pathname.startsWith("/api/master/stores/")) {
      const storeCode = decodeURIComponent(pathname.replace("/api/master/stores/", ""));
      const payload = await readJsonBody(request);
      const result = await updateMasterStoreStatus(pool, storeCode, payload);
      sendJson(response, 200, result);
      return;
    }

    if (request.method === "PATCH" && pathname.startsWith("/api/workflow/faults/")) {
      const ticketNumber = decodeURIComponent(pathname.replace("/api/workflow/faults/", "").replace("/remark", ""));
      const payload = await readJsonBody(request);
      const result = await updateFaultStatus(pool, ticketNumber, payload.remark);
      sendJson(response, 200, { ok: true, result });
      return;
    }

    if (request.method === "POST" && pathname === "/api/raw-import") {
      const payload = await readJsonBody(request);
      const result = await importWorkbookToRawDb(pool, payload);
      sendJson(response, 200, result);
      return;
    }

    // Technical Training API
    if (request.method === "GET" && pathname === "/api/training/options") {
      const result = await fetchTrainingFormOptions(pool);
      sendJson(response, 200, result);
      return;
    }

    if (request.method === "GET" && pathname === "/api/training/evidence") {
      const result = await fetchTrainingEvidence(pool, requestUrl.searchParams);
      sendJson(response, 200, result);
      return;
    }

    if (request.method === "GET" && (pathname === "/api/training/image-data" || pathname === "/api/deep-cleaning/image-data")) {
      const dataUrl = getTrainingImageDataUrl(requestUrl.searchParams.get("path"));
      sendJson(response, 200, { ok: true, dataUrl });
      return;
    }

    if (request.method === "GET" && pathname === "/api/deep-cleaning/evidence") {
      const result = await fetchDeepCleaningEvidence(pool, requestUrl.searchParams);
      sendJson(response, 200, result);
      return;
    }

    if (request.method === "POST" && pathname === "/api/deep-cleaning/evidence") {
      const payload = await parseMultipart(request, DEEP_CLEANING_UPLOAD_DIR, "/uploads/deep-cleaning");
      const beforeImages = Array.isArray(payload.beforeImages) ? payload.beforeImages : [payload.beforeImages].filter(Boolean);
      const afterImages = Array.isArray(payload.afterImages) ? payload.afterImages : [payload.afterImages].filter(Boolean);
      const uploadedImages = [...beforeImages, ...afterImages];

      if (beforeImages.length === 0 || afterImages.length === 0) {
        removeUploadedFiles(uploadedImages.map((image) => image.path));
        sendJson(response, 400, { ok: false, error: "Upload at least one before image and one after image" });
        return;
      }

      if (beforeImages.length > 5 || afterImages.length > 5) {
        removeUploadedFiles(uploadedImages.map((image) => image.path));
        sendJson(response, 400, { ok: false, error: "Maximum 5 before images and 5 after images are allowed" });
        return;
      }

      let result;
      try {
        result = await createDeepCleaningEvidence(pool, {
          storeId: payload.storeId,
          storeName: payload.storeName,
          stateName: payload.stateName,
          location: payload.location,
          monthKey: payload.monthKey,
          remarks: payload.remarks,
          beforeImagePaths: beforeImages.map((image) => image.path),
          afterImagePaths: afterImages.map((image) => image.path),
        });
      } catch (error) {
        removeUploadedFiles(uploadedImages.map((image) => image.path));
        throw error;
      }

      sendJson(response, 201, result);
      return;
    }

    if (request.method === "POST" && pathname === "/api/training/evidence") {
      const payload = await parseMultipart(request);
      const uploadedImages = [
        ...(Array.isArray(payload.images) ? payload.images : [payload.images].filter(Boolean)),
        ...(Array.isArray(payload.image) ? payload.image : [payload.image].filter(Boolean)),
      ];

      if (uploadedImages.length === 0) {
        sendJson(response, 400, { ok: false, error: "No image uploaded" });
        return;
      }
      if (uploadedImages.length > 5) {
        removeUploadedFiles(uploadedImages.map((image) => image.path));
        sendJson(response, 400, { ok: false, error: "Maximum 5 images are allowed for one training entry" });
        return;
      }

      const dbPayload = {
        stateName: payload.stateName,
        fieldOffice: payload.fieldOffice,
        storeId: payload.storeId,
        storeName: payload.storeName,
        title: payload.title,
        remarks: payload.remarks,
        imagePaths: uploadedImages.map((image) => image.path),
      };
      let result;
      try {
        result = await createTrainingEvidence(pool, dbPayload);
      } catch (error) {
        removeUploadedFiles(uploadedImages.map((image) => image.path));
        throw error;
      }
      sendJson(response, 201, result);
      return;
    }

    if (request.method === "DELETE" && pathname.startsWith("/api/deep-cleaning/evidence/")) {
      const evidenceId = pathname.replace("/api/deep-cleaning/evidence/", "");
      const result = await deleteDeepCleaningEvidence(pool, evidenceId);
      removeUploadedFiles(result.imagePaths);
      sendJson(response, 200, { ok: true });
      return;
    }

    if (request.method === "DELETE" && pathname.startsWith("/api/training/evidence/")) {
      const evidenceId = pathname.replace("/api/training/evidence/", "");
      const result = await deleteTrainingEvidence(pool, evidenceId);
      removeUploadedFiles(result.imagePaths || [result.imagePath]);
      sendJson(response, 200, { ok: true });
      return;
    }

    sendJson(response, 404, { ok: false, error: "Route not found" });
  } catch (error) {
    sendJson(response, error.statusCode || 500, {
      ok: false,
      error: error.message || "Unexpected server error",
    });
  }
});

server.listen(PORT, () => {
  console.log(`QPMS DB API running on http://localhost:${PORT}`);
});
