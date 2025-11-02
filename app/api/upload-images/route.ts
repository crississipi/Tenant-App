//app\api\upload-images\route.ts

import { NextRequest, NextResponse } from "next/server";

const GITHUB_TOKEN = process.env.GITHUB_TOKEN!;
const GITHUB_USERNAME = process.env.GITHUB_USERNAME!;
const GITHUB_REPO = process.env.GITHUB_REPO!;
const GITHUB_BRANCH = process.env.GITHUB_BRANCH || "main";

export async function POST(req: NextRequest) {
  try {
    const { images, folderName } = await req.json();

    if (!images?.length || !folderName) {
      return NextResponse.json(
        { success: false, message: "Missing images or folderName" },
        { status: 400 }
      );
    }

    const uploadedUrls: string[] = [];

    for (const img of images) {
      if (!img.name || !img.content) {
        throw new Error("Invalid image data: missing name or content");
      }

      const filePath = `${folderName}/${img.name}`;
      const githubApiUrl = `https://api.github.com/repos/${GITHUB_USERNAME}/${GITHUB_REPO}/contents/${filePath}`;

      // Upload image to GitHub
      const response = await fetch(githubApiUrl, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${GITHUB_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: `Upload ${img.name}`,
          content: img.content.replace(/\s/g, ""), // must be base64 string
          branch: GITHUB_BRANCH,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        console.error("GitHub upload failed:", data);
        throw new Error(
          data?.message || `Failed to upload ${img.name} to GitHub.`
        );
      }
      
      const imageUrl = `https://raw.githubusercontent.com/${GITHUB_USERNAME}/${GITHUB_REPO}/${GITHUB_BRANCH}/${filePath}`;

      uploadedUrls.push(imageUrl);
    }

    return NextResponse.json({ success: true, urls: uploadedUrls });
  } catch (error: any) {
    console.error("Upload Error:", error);
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
}
