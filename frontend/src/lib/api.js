import axios from "axios";

export const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export const api = axios.create({ baseURL: API });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("okkax_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export function apiError(e) {
  const detail = e?.response?.data?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) return detail.map((d) => d?.msg || JSON.stringify(d)).join(" ");
  if (detail?.msg) return detail.msg;
  return e?.message || "Terjadi kesalahan.";
}

export const idr = (n) =>
  "Rp" + new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(Math.round(n || 0));

export const compact = (n) => {
  const v = Number(n || 0);
  if (Math.abs(v) >= 1e12) return `Rp${(v / 1e12).toFixed(2)} T`;
  if (Math.abs(v) >= 1e9) return `Rp${(v / 1e9).toFixed(2)} M`;
  if (Math.abs(v) >= 1e6) return `Rp${(v / 1e6).toFixed(1)} jt`;
  return idr(v);
};

export const num = (n) => new Intl.NumberFormat("id-ID").format(Math.round(n || 0));

export const DISCLAIMER =
  "Seluruh nama, organisasi, talent, harga, rider, transaksi, tiket, dan metrik pada mode demo merupakan data fiktif untuk keperluan demonstrasi kompetisi.";
export const SANDBOX_NOTICE = "Mode demo kompetisi. Tidak ada uang nyata yang akan ditagihkan.";
export const LOGO_URL =
  "https://customer-assets-eiarnc6j.emergentagent.net/job_economy-network/artifacts/o3lnpfcw_LOGO%20OKKAX.png";

export const DEMO_EVENT_ID = "evt-aruna-2026";

export async function downloadDoc(path, filename) {
  const res = await api.get(path, { responseType: "blob" });
  const url = window.URL.createObjectURL(res.data);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}
