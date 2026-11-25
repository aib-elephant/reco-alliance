import axios, { AxiosRequestConfig } from "axios";

export async function api<T>(
  url: string,
  options?: AxiosRequestConfig,
): Promise<T> {
  try {
    const response = await axios({
      url,
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options?.headers,
      },
      withCredentials: true, // equivalent to credentials: "include"
    });

    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.log("ax error", error);

      throw new Error(error.response?.data?.error || "API Error");
    }
    throw new Error("API Error");
  }
}
