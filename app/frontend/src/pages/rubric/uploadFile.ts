import axios from "axios";

export async function uploadFile(file: File): Promise<void> {
  const formData = new FormData();
  formData.append("file", file);

  await axios.post("/upload", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });
}
