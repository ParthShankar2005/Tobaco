import { UserProfile } from "@/auth/roleAuth";
import { OrderRecord } from "../../types";

const DEFAULT_GST_RATE = 18;
const DEFAULT_CGST_RATE = DEFAULT_GST_RATE / 2;
const DEFAULT_SGST_RATE = DEFAULT_GST_RATE / 2;

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

const formatDateTime = (date: string) =>
  new Date(date).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

export interface BillRenderOptions {
  includeGst?: boolean;
  shopAddress?: string;
}

const safeUrl = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("data:image/")) return trimmed;
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return trimmed;
  return "";
};

export const buildBillHtml = (
  order: OrderRecord,
  distributorProfile: UserProfile,
  options: BillRenderOptions = {},
) => {
  const includeGst = options.includeGst ?? true;
  const taxableAmount = Number(order.subtotal.toFixed(2));
  const cgstAmount = includeGst ? Number((taxableAmount * (DEFAULT_CGST_RATE / 100)).toFixed(2)) : 0;
  const sgstAmount = includeGst ? Number((taxableAmount * (DEFAULT_SGST_RATE / 100)).toFixed(2)) : 0;
  const totalWithGst = Number((taxableAmount + cgstAmount + sgstAmount).toFixed(2));
  const title = distributorProfile.billPrintSettings.billTitle || "TOBACO";
  const billDisplayId = order.id.replace(/\//g, "-");

  const rows = order.items
    .map(
      (item) => `
        <tr>
          <td>${escapeHtml(item.itemNumber || "-")}</td>
          <td>${escapeHtml(item.productName)}</td>
          <td class="right">${item.quantity}</td>
          <td class="right">${item.unitPrice.toFixed(2)}</td>
          <td class="right">${item.lineTotal.toFixed(2)}</td>
        </tr>
      `,
    )
    .join("");

  const logoUrl = safeUrl(distributorProfile.logoDataUrl || "");

  return `
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>Bill ${escapeHtml(billDisplayId)}</title>
        <style>
          @page { size: 80mm auto; margin: 4mm; }
          body {
            width: 72mm;
            margin: 0 auto;
            font-family: "Courier New", monospace;
            font-size: 11px;
            color: #111;
          }
          .center { text-align: center; }
          .right { text-align: right; }
          .bold { font-weight: 700; }
          .small { font-size: 10px; }
          .line { border-top: 1px dashed #111; margin: 6px 0; }
          .row { display: flex; justify-content: space-between; gap: 8px; }
          table { width: 100%; border-collapse: collapse; }
          th, td { padding: 2px 0; vertical-align: top; }
          th { border-bottom: 1px dashed #111; font-size: 10px; }
          .logo {
            width: 100px;
            height: 100px;
            object-fit: contain;
            display: inline-block;
          }
        </style>
      </head>
      <body>
        ${
          logoUrl
            ? `<div class="center"><img class="logo" src="${escapeHtml(logoUrl)}" alt="logo" /></div>`
            : ""
        }
        <div class="center bold">${escapeHtml(title)}</div>
        <div class="center small">${escapeHtml(distributorProfile.businessName || "Distributor")}</div>
        ${
          distributorProfile.billPrintSettings.showGstNumber
            ? `<div class="center small">GSTIN: ${escapeHtml(distributorProfile.gstNumber || "N/A")}</div>`
            : ""
        }
        ${
          distributorProfile.billPrintSettings.showMobile
            ? `<div class="center small">Phone: ${escapeHtml(distributorProfile.mobileNumber || "-")}</div>`
            : ""
        }
        ${
          distributorProfile.billPrintSettings.showWhatsapp
            ? `<div class="center small">WhatsApp: ${escapeHtml(distributorProfile.whatsappNumber || "-")}</div>`
            : ""
        }
        ${
          distributorProfile.billPrintSettings.showAddress
            ? `<div class="center small">${escapeHtml(distributorProfile.address || "-")}</div>`
            : ""
        }
        <div class="line"></div>
        <div class="row"><span>Bill No:</span><span class="bold">${escapeHtml(billDisplayId)}</span></div>
        <div class="row"><span>Date:</span><span>${escapeHtml(formatDateTime(order.createdAt))}</span></div>
        <div class="row"><span>Shop:</span><span>${escapeHtml(order.shopName)}</span></div>
        <div class="row"><span>Owner:</span><span>${escapeHtml(order.ownerName)}</span></div>
        <div class="row"><span>Mobile:</span><span>${escapeHtml(order.mobile)}</span></div>
        ${
          distributorProfile.billPrintSettings.showShopAddress
            ? `<div class="row"><span>Address:</span><span>${escapeHtml(options.shopAddress || "-")}</span></div>`
            : ""
        }
        <div class="line"></div>
        <table>
          <thead>
            <tr>
              <th>No</th>
              <th>Item</th>
              <th class="right">Qty</th>
              <th class="right">Rate</th>
              <th class="right">Amt</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
        <div class="line"></div>
        <div class="row"><span>Taxable:</span><span>${taxableAmount.toFixed(2)}</span></div>
        ${
          includeGst
            ? `<div class="row"><span>CGST ${DEFAULT_CGST_RATE}%:</span><span>${cgstAmount.toFixed(2)}</span></div>
               <div class="row"><span>SGST ${DEFAULT_SGST_RATE}%:</span><span>${sgstAmount.toFixed(2)}</span></div>`
            : `<div class="row"><span>GST:</span><span>Not Applied</span></div>`
        }
        <div class="row bold"><span>Grand Total:</span><span>INR ${totalWithGst.toFixed(2)}</span></div>
        <div class="line"></div>
        <div class="center small">Payment: ${escapeHtml(order.paymentMethod.toUpperCase())}</div>
      </body>
    </html>
  `;
};

export const openBillPrintWindow = (
  order: OrderRecord,
  distributorProfile: UserProfile,
  options: BillRenderOptions = {},
) => {
  const popup = window.open("", "_blank", "width=430,height=760");
  if (!popup) return false;
  popup.document.open();
  popup.document.write(buildBillHtml(order, distributorProfile, options));
  popup.document.close();

  const waitForImages = async () => {
    const images = Array.from(popup.document.images);
    if (images.length === 0) return;

    await new Promise<void>((resolve) => {
      let pending = 0;
      let finished = false;
      const done = () => {
        if (finished) return;
        finished = true;
        resolve();
      };
      const onAssetDone = () => {
        pending -= 1;
        if (pending <= 0) done();
      };

      for (const image of images) {
        if (image.complete) continue;
        pending += 1;
        image.addEventListener("load", onAssetDone, { once: true });
        image.addEventListener("error", onAssetDone, { once: true });
      }

      if (pending === 0) {
        done();
        return;
      }
      window.setTimeout(done, 1800);
    });
  };

  let didPrint = false;
  const printWhenReady = async () => {
    if (didPrint || popup.closed) return;
    didPrint = true;
    try {
      await waitForImages();
    } catch {
      // Ignore asset timing issues and still attempt print.
    }
    if (popup.closed) return;
    popup.focus();
    popup.print();
  };

  popup.addEventListener("load", () => {
    void printWhenReady();
  });
  window.setTimeout(() => {
    void printWhenReady();
  }, 450);
  return true;
};

export const downloadBillHtml = (
  order: OrderRecord,
  distributorProfile: UserProfile,
  options: BillRenderOptions = {},
) => {
  const html = buildBillHtml(order, distributorProfile, options);
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const href = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = href;
  const safeFileId = order.id.replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, " ").trim();
  anchor.download = `${safeFileId}-bill.html`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(href);
};
