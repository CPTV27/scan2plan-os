import { Router } from "express";
import { isAuthenticated } from "../../replit_integrations/auth";
import { asyncHandler } from "../../middleware/errorHandler";
import { getDriveClient } from "../../google-clients";
import { log } from "../../lib/logger";
import multer from "multer";
import fs from "fs";

export const googleDriveRouter = Router();

const DRIVE_ALLOWED_TYPES = [
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "text/plain",
    "text/csv",
];

const upload = multer({
    dest: "/tmp/uploads/",
    limits: {
        fileSize: 100 * 1024 * 1024, // 100MB max for Drive uploads
        files: 1,
    },
    fileFilter: (_req, file, cb) => {
        if (DRIVE_ALLOWED_TYPES.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error(`File type ${file.mimetype} is not allowed for Drive upload`));
        }
    },
});

// GET /api/google/drive/files
googleDriveRouter.get(
    "/api/google/drive/files",
    isAuthenticated,
    asyncHandler(async (req, res) => {
        try {
            const drive = await getDriveClient();
            const pageSize = Number(req.query.pageSize) || 10;
            const q = req.query.q as string || '';

            const response = await drive.files.list({
                pageSize,
                q: q || undefined,
                fields: 'files(id, name, mimeType, modifiedTime, webViewLink, iconLink)',
            });

            res.json({ files: response.data.files || [] });
        } catch (error: any) {
            log("ERROR: Drive list error - " + (error?.message || error));
            res.status(500).json({ message: error.message || "Failed to list files" });
        }
    })
);

// POST /api/google/drive/upload
googleDriveRouter.post(
    "/api/google/drive/upload",
    isAuthenticated,
    upload.single("file"),
    asyncHandler(async (req, res) => {
        try {
            if (!req.file) {
                return res.status(400).json({ message: "No file provided" });
            }

            const drive = await getDriveClient();
            const { name, folderId } = req.body;

            const response = await drive.files.create({
                requestBody: {
                    name: name || req.file.originalname,
                    parents: folderId ? [folderId] : undefined,
                },
                media: {
                    mimeType: req.file.mimetype,
                    body: fs.createReadStream(req.file.path),
                },
                fields: 'id, name, webViewLink',
            });

            fs.unlinkSync(req.file.path);

            res.json({
                id: response.data.id,
                name: response.data.name,
                webViewLink: response.data.webViewLink,
            });
        } catch (error: any) {
            log("ERROR: Drive upload error - " + (error?.message || error));
            if (req.file?.path) fs.unlinkSync(req.file.path);
            res.status(500).json({ message: error.message || "Failed to upload file" });
        }
    })
);
