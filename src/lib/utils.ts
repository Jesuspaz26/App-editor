import { ScriptScene } from "../types";

export const generateSRT = (scenes: ScriptScene[]): string => {
  return scenes
    .map((scene, index) => {
      return `${index + 1}\n${scene.startTime} --> ${scene.endTime}\n${scene.text}\n`;
    })
    .join("\n");
};

export const downloadFile = (content: string, fileName: string, contentType: string) => {
  const a = document.createElement("a");
  const file = new Blob([content], { type: contentType });
  a.href = URL.createObjectURL(file);
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(a.href);
};
