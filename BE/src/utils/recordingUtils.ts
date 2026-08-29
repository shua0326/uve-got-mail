import prisma from "../database/prisma";
import { Recording } from "@prisma/client";

export async function saveRecording(data: Buffer): Promise<string> {
  const recording = await prisma.recording.create({
    data: { data: new Uint8Array(data), byteSize: data.length },
  });
  return recording.id;
}

export async function getRecording(id: string): Promise<Recording | undefined> {
  const recording = await prisma.recording.findUnique({ where: { id } });
  if (!recording) return undefined;
  return { ...recording, data: Buffer.from(recording.data) };
}