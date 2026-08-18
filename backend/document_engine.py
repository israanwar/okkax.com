"""OKKAX Global Document Design System Engine.

Unified, print-first, architectural ReportLab PDF generator for all OKKAX documents.
"""

import io
import os
from datetime import datetime, timezone
import hashlib
from typing import List, Dict, Any, Tuple, Optional

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.pdfgen import canvas
from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
    PageBreak,
    KeepTogether,
    HRFlowable,
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_RIGHT, TA_CENTER, TA_JUSTIFY

# -----------------------------------------------------------------------------
# 1. OKKAX Monochrome Design Tokens
# -----------------------------------------------------------------------------
COLOR_BLACK = colors.HexColor("#000000")
COLOR_INK = colors.HexColor("#09090b")
COLOR_INK_MUTED = colors.HexColor("#52525b")
COLOR_INK_LIGHT = colors.HexColor("#71717a")
COLOR_BORDER = colors.HexColor("#e4e4e7")
COLOR_BORDER_STRONG = colors.HexColor("#18181b")
COLOR_SURFACE_MUTED = colors.HexColor("#f4f4f5")
COLOR_SURFACE_CARD = colors.HexColor("#fafafa")
COLOR_WHITE = colors.HexColor("#ffffff")
COLOR_PILL_BG = colors.HexColor("#27272a")

PAGE_WIDTH, PAGE_HEIGHT = A4
MARGIN_LEFT = 15 * mm
MARGIN_RIGHT = 15 * mm
MARGIN_TOP = 36 * mm
MARGIN_BOTTOM = 28 * mm
USABLE_WIDTH = PAGE_WIDTH - MARGIN_LEFT - MARGIN_RIGHT

LOGO_BLACK_PATH = os.path.join(os.path.dirname(__file__), "assets", "okkax-wordmark-black.png")
if not os.path.exists(LOGO_BLACK_PATH):
    # Fallback to frontend public assets
    LOGO_BLACK_PATH = os.path.abspath(
        os.path.join(os.path.dirname(__file__), "..", "frontend", "public", "assets", "okkax-wordmark-v3.png")
    )


def _rp(v: Any) -> str:
    """Format integer to IDR string (e.g. Rp2.983.000.000)."""
    try:
        val = int(v or 0)
        formatted = f"{abs(val):,}".replace(",", ".")
        if val < 0:
            return f"-Rp{formatted}"
        return f"Rp{formatted}"
    except (ValueError, TypeError):
        return "Rp0"


def _num(v: Any) -> str:
    """Format integer number with thousand separators (e.g. 2.000)."""
    try:
        return f"{int(v or 0):,}".replace(",", ".")
    except (ValueError, TypeError):
        return "0"


# -----------------------------------------------------------------------------
# 2. Numbered Canvas with Repeating Top Brand Rail & Footer
# -----------------------------------------------------------------------------
class OkkaxDocumentCanvas(canvas.Canvas):
    """Two-pass ReportLab Canvas for exact total page count and repeating header/footer."""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []
        self.doc_type = "OPERATIONAL DOCUMENT"
        self.doc_code = "OKKAX-DOC"
        self.event_code = ""
        self.event_name = ""

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self._draw_brand_rail(num_pages)
            self._draw_system_footer(num_pages)
            super().showPage()
        super().save()

    def _draw_brand_rail(self, total_pages: int):
        page_num = self._pageNumber
        page_str = f"{page_num:02d} / {total_pages:02d}"

        # 1. Top Logo on left
        if os.path.exists(LOGO_BLACK_PATH):
            try:
                # 30mm width x 7.5mm height
                self.drawImage(
                    LOGO_BLACK_PATH,
                    MARGIN_LEFT,
                    PAGE_HEIGHT - 22 * mm,
                    width=28 * mm,
                    height=7 * mm,
                    mask="auto",
                    preserveAspectRatio=True,
                )
            except Exception:
                self._draw_fallback_logo()
        else:
            self._draw_fallback_logo()

        # 2. Top Right System Category Tag
        self.setFont("Helvetica-Bold", 6.5)
        self.setFillColor(COLOR_INK_MUTED)
        self.drawRightString(
            PAGE_WIDTH - MARGIN_RIGHT,
            PAGE_HEIGHT - 17.5 * mm,
            "LIVE EVENT OPERATING NETWORK",
        )

        # 3. Document Identifier Row
        y_id = PAGE_HEIGHT - 29 * mm

        # Document Type (e.g. QUOTATION / PAYMENT SCHEDULE)
        self.setFont("Helvetica-Bold", 8.5)
        self.setFillColor(COLOR_BLACK)
        self.drawString(MARGIN_LEFT, y_id, self.doc_type.upper())

        # Document / Event Code in Monospace
        if self.doc_code:
            self.setFont("Courier-Bold", 8)
            self.setFillColor(COLOR_INK_MUTED)
            self.drawString(MARGIN_LEFT + 46 * mm, y_id, self.doc_code)

        # Running Page Count on Far Right
        self.setFont("Courier-Bold", 8)
        self.setFillColor(COLOR_BLACK)
        self.drawRightString(PAGE_WIDTH - MARGIN_RIGHT, y_id, page_str)

        # 4. Bold Top Brand Rail Divider Line
        self.setStrokeColor(COLOR_BORDER_STRONG)
        self.setLineWidth(1.0)
        self.line(MARGIN_LEFT, PAGE_HEIGHT - 31.5 * mm, PAGE_WIDTH - MARGIN_RIGHT, PAGE_HEIGHT - 31.5 * mm)

    def _draw_fallback_logo(self):
        self.setFont("Helvetica-Bold", 12)
        self.setFillColor(COLOR_BLACK)
        self.drawString(MARGIN_LEFT, PAGE_HEIGHT - 20 * mm, "OKKAX")

    def _draw_system_footer(self, total_pages: int):
        page_num = self._pageNumber
        page_str = f"{page_num:02d} / {total_pages:02d}"

        # 1. Hairline Divider
        y_div = 22 * mm
        self.setStrokeColor(COLOR_BORDER)
        self.setLineWidth(0.6)
        self.line(MARGIN_LEFT, y_div, PAGE_WIDTH - MARGIN_RIGHT, y_div)

        # 2. Left Legal Disclaimer (Mode Demo / Tax)
        y_text = 17.5 * mm
        self.setFont("Helvetica", 6.5)
        self.setFillColor(COLOR_INK_LIGHT)
        self.drawString(
            MARGIN_LEFT,
            y_text,
            "Dokumen resmi dihasilkan sistem OKKAX · Mode Demo Kompetisi · Data bersifat sandbox, tanpa uang nyata.",
        )
        self.drawString(
            MARGIN_LEFT,
            y_text - 3.5 * mm,
            "Estimasi pajak dan breakdown biaya memerlukan verifikasi profesional dan bukan merupakan nasihat legal/pajak.",
        )

        # 3. Right Hash & Page Numbering
        doc_hash = hashlib.md5(f"{self.doc_code}-{self.doc_type}".encode()).hexdigest()[:8].upper()
        self.setFont("Courier", 6.5)
        self.drawRightString(
            PAGE_WIDTH - MARGIN_RIGHT,
            y_text,
            f"SEC-ID: {doc_hash} · PG {page_str}",
        )
        self.drawRightString(
            PAGE_WIDTH - MARGIN_RIGHT,
            y_text - 3.5 * mm,
            f"OKKAX OS V2 · {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M')} UTC",
        )


# -----------------------------------------------------------------------------
# 3. Typography Styles & Flowable Primitives
# -----------------------------------------------------------------------------
def get_okkax_doc_styles():
    styles = getSampleStyleSheet()

    # Document Hero Heading
    styles.add(ParagraphStyle(
        "DocHeroTitle",
        fontName="Helvetica-Bold",
        fontSize=15,
        leading=18,
        textColor=COLOR_BLACK,
        spaceAfter=2,
    ))

    # Hero Subtitle / Context
    styles.add(ParagraphStyle(
        "DocHeroSubtitle",
        fontName="Helvetica",
        fontSize=8.5,
        leading=11,
        textColor=COLOR_INK_MUTED,
        spaceAfter=8,
    ))

    # Section Heading
    styles.add(ParagraphStyle(
        "DocSectionHeading",
        fontName="Helvetica-Bold",
        fontSize=9.5,
        leading=12,
        textColor=COLOR_BLACK,
        spaceBefore=8,
        spaceAfter=4,
        textTransform="uppercase",
    ))

    # Key-Value Grid Label
    styles.add(ParagraphStyle(
        "DocMetaKey",
        fontName="Helvetica-Bold",
        fontSize=7.5,
        leading=9.5,
        textColor=COLOR_INK_MUTED,
        textTransform="uppercase",
    ))

    # Key-Value Grid Value
    styles.add(ParagraphStyle(
        "DocMetaVal",
        fontName="Helvetica",
        fontSize=8.5,
        leading=11,
        textColor=COLOR_BLACK,
    ))

    # Table Header Cell
    styles.add(ParagraphStyle(
        "DocTH",
        fontName="Helvetica-Bold",
        fontSize=7.5,
        leading=9.5,
        textColor=COLOR_BLACK,
        textTransform="uppercase",
    ))
    styles.add(ParagraphStyle(
        "DocTHRight",
        fontName="Helvetica-Bold",
        fontSize=7.5,
        leading=9.5,
        textColor=COLOR_BLACK,
        alignment=TA_RIGHT,
        textTransform="uppercase",
    ))

    # Table Body Cell
    styles.add(ParagraphStyle(
        "DocTD",
        fontName="Helvetica",
        fontSize=8,
        leading=10,
        textColor=COLOR_INK,
    ))
    styles.add(ParagraphStyle(
        "DocTDBold",
        fontName="Helvetica-Bold",
        fontSize=8,
        leading=10,
        textColor=COLOR_BLACK,
    ))
    styles.add(ParagraphStyle(
        "DocTDMono",
        fontName="Courier",
        fontSize=8,
        leading=10,
        textColor=COLOR_INK,
    ))
    styles.add(ParagraphStyle(
        "DocTDRight",
        fontName="Helvetica",
        fontSize=8,
        leading=10,
        textColor=COLOR_BLACK,
        alignment=TA_RIGHT,
    ))
    styles.add(ParagraphStyle(
        "DocTDRightBold",
        fontName="Helvetica-Bold",
        fontSize=8,
        leading=10,
        textColor=COLOR_BLACK,
        alignment=TA_RIGHT,
    ))

    # Card KPI Label
    styles.add(ParagraphStyle(
        "DocKpiLabel",
        fontName="Helvetica-Bold",
        fontSize=7,
        leading=9,
        textColor=COLOR_INK_MUTED,
        textTransform="uppercase",
    ))

    # Card KPI Dominant Value
    styles.add(ParagraphStyle(
        "DocKpiValueDominant",
        fontName="Helvetica-Bold",
        fontSize=13,
        leading=15,
        textColor=COLOR_BLACK,
    ))

    # Card KPI Normal Value
    styles.add(ParagraphStyle(
        "DocKpiValue",
        fontName="Helvetica-Bold",
        fontSize=10,
        leading=12,
        textColor=COLOR_INK,
    ))

    return styles


# -----------------------------------------------------------------------------
# 4. Quotation Document Builder
# -----------------------------------------------------------------------------
def build_quotation_pdf(event: dict, budget: dict) -> bytes:
    """Build standardized OKKAX Quotation PDF."""
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=A4,
        leftMargin=MARGIN_LEFT,
        rightMargin=MARGIN_RIGHT,
        topMargin=MARGIN_TOP,
        bottomMargin=MARGIN_BOTTOM,
    )
    styles = get_okkax_doc_styles()
    story = []

    # 1. Document Hero: Event Title & Meta Strip
    event_title = event.get("name", "Event Untitled")
    city = event.get("city", "Indonesia")
    start_date = event.get("start_date", "—")
    event_type = event.get("event_type", "Live Event")
    organizer = event.get("organizer_name") or event.get("owner_name") or "PT Aruna Consumer Indonesia"

    story.append(Paragraph(event_title, styles["DocHeroTitle"]))
    story.append(
        Paragraph(
            f"{city.upper()} · {start_date} · {event_type.upper()} · ORGANIZER: {organizer.upper()}",
            styles["DocHeroSubtitle"],
        )
    )
    story.append(Spacer(1, 2 * mm))

    # 2. Event Identity / Metadata 4-Column Box
    venue = event.get("venue_name") or "Belum dikonfirmasi"
    days = f"{event.get('days', 1)} hari event + {event.get('setup_days', 1)} setup day"
    capacity = f"{_num(event.get('capacity', 0))} penonton"
    target_demographic = event.get("target_demographic", "General Public")

    meta_data = [
        [
            Paragraph("VENUE", styles["DocMetaKey"]),
            Paragraph("DURASI PELAKSANAAN", styles["DocMetaKey"]),
            Paragraph("TARGET KAPASITAS", styles["DocMetaKey"]),
            Paragraph("DEMOGRAFI TARGET", styles["DocMetaKey"]),
        ],
        [
            Paragraph(venue, styles["DocMetaVal"]),
            Paragraph(days, styles["DocMetaVal"]),
            Paragraph(capacity, styles["DocMetaVal"]),
            Paragraph(target_demographic, styles["DocMetaVal"]),
        ],
    ]
    meta_table = Table(meta_data, colWidths=[48 * mm, 44 * mm, 44 * mm, 44 * mm])
    meta_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), COLOR_SURFACE_MUTED),
        ("PADDING", (0, 0), (-1, -1), 2.5 * mm),
        ("BOX", (0, 0), (-1, -1), 0.6, COLOR_BORDER),
        ("INNERGRID", (0, 0), (-1, -1), 0.4, COLOR_BORDER),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ]))
    story.append(meta_table)
    story.append(Spacer(1, 4 * mm))

    # 3. Financial Summary KPI Grid
    total_cost = budget.get("total_cost", 0)
    confirmed_funding = budget.get("confirmed_funding", 0)
    funding_gap = budget.get("funding_gap", 0)
    projected_ticket = budget.get("projected_ticket_revenue", 0)
    break_even = budget.get("break_even_tickets", 0)

    # Semantic funding gap formatting
    if funding_gap < 0:
        gap_label = "SURPLUS PENDANAAN"
        gap_str = f"+{_rp(abs(funding_gap))}"
    elif funding_gap > 0:
        gap_label = "GAP PENDANAAN DIBUTUHKAN"
        gap_str = _rp(funding_gap)
    else:
        gap_label = "PENDANAAN PENUH (100%)"
        gap_str = "Rp0"

    kpi_data = [
        [
            Paragraph("TOTAL ESTIMASI BIAYA EVENT (OPEX)", styles["DocKpiLabel"]),
            Paragraph("PENDANAAN TERKONFIRMASI", styles["DocKpiLabel"]),
            Paragraph(gap_label, styles["DocKpiLabel"]),
            Paragraph("PROYEKSI TIKET & BREAK-EVEN", styles["DocKpiLabel"]),
        ],
        [
            Paragraph(_rp(total_cost), styles["DocKpiValueDominant"]),
            Paragraph(_rp(confirmed_funding), styles["DocKpiValue"]),
            Paragraph(gap_str, styles["DocKpiValue"]),
            Paragraph(f"{_rp(projected_ticket)} · {break_even} tix", styles["DocKpiValue"]),
        ],
    ]
    kpi_table = Table(kpi_data, colWidths=[52 * mm, 42 * mm, 44 * mm, 42 * mm])
    kpi_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (0, 1), COLOR_WHITE),
        ("BACKGROUND", (1, 0), (-1, -1), COLOR_SURFACE_CARD),
        ("BOX", (0, 0), (-1, -1), 0.8, COLOR_BORDER_STRONG),
        ("INNERGRID", (0, 0), (-1, -1), 0.4, COLOR_BORDER),
        ("PADDING", (0, 0), (-1, -1), 2.5 * mm),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ]))
    story.append(kpi_table)
    story.append(Spacer(1, 5 * mm))

    # 4. Cost Breakdown Table
    story.append(Paragraph("RINCIAN ESTIMASI BIAYA OPERASIONAL", styles["DocSectionHeading"]))
    story.append(Spacer(1, 1 * mm))

    by_cat = sorted(budget.get("cost_by_category", {}).items(), key=lambda x: -x[1])
    table_rows = [
        [
            Paragraph("NO", styles["DocTH"]),
            Paragraph("KATEGORI PENGELUARAN", styles["DocTH"]),
            Paragraph("ALOKASI SHARE (%)", styles["DocTHRight"]),
            Paragraph("NOMINAL ANGGARAN (IDR)", styles["DocTHRight"]),
        ]
    ]

    for idx, (cat, amount) in enumerate(by_cat, start=1):
        share_pct = (amount / total_cost * 100) if total_cost > 0 else 0.0
        table_rows.append([
            Paragraph(f"{idx:02d}", styles["DocTDMono"]),
            Paragraph(cat, styles["DocTDBold"]),
            Paragraph(f"{share_pct:.1f}%", styles["DocTDRight"]),
            Paragraph(_rp(amount), styles["DocTDRight"]),
        ])

    # Total Row
    table_rows.append([
        Paragraph("", styles["DocTDBold"]),
        Paragraph("TOTAL EVENT COST", styles["DocTDBold"]),
        Paragraph("100.0%", styles["DocTDRightBold"]),
        Paragraph(_rp(total_cost), styles["DocTDRightBold"]),
    ])

    breakdown_table = Table(
        table_rows,
        colWidths=[12 * mm, 98 * mm, 30 * mm, 40 * mm],
        repeatRows=1,
    )
    breakdown_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), COLOR_SURFACE_MUTED),
        ("LINEBELOW", (0, 0), (-1, 0), 1.0, COLOR_BORDER_STRONG),
        ("LINEBELOW", (0, 1), (-1, -2), 0.3, COLOR_BORDER),
        ("LINEABOVE", (0, -1), (-1, -1), 1.0, COLOR_BORDER_STRONG),
        ("BACKGROUND", (0, -1), (-1, -1), COLOR_SURFACE_CARD),
        ("PADDING", (0, 0), (-1, -1), 1.8 * mm),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ]))
    story.append(breakdown_table)

    # Canvas metadata attributes
    def on_first_page(canvas_obj, doc_obj):
        canvas_obj.doc_type = "QUOTATION ESTIMATE"
        canvas_obj.doc_code = f"QUO-{event.get('event_code', 'EVT-0000')}"
        canvas_obj.event_code = event.get("event_code", "")
        canvas_obj.event_name = event_title

    doc.build(
        story,
        canvasmaker=OkkaxDocumentCanvas,
        onFirstPage=on_first_page,
    )
    buf.seek(0)
    return buf.getvalue()


# -----------------------------------------------------------------------------
# 5. Payment Schedule Document Builder (Robust Multi-Page)
# -----------------------------------------------------------------------------
def build_payment_schedule_pdf(event: dict, milestones: List[dict]) -> bytes:
    """Build standardized OKKAX Payment Schedule PDF with multi-page support."""
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=A4,
        leftMargin=MARGIN_LEFT,
        rightMargin=MARGIN_RIGHT,
        topMargin=MARGIN_TOP,
        bottomMargin=MARGIN_BOTTOM,
    )
    styles = get_okkax_doc_styles()
    story = []

    # 1. Document Hero: Event Title & Meta Strip
    event_title = event.get("name", "Event Untitled")
    city = event.get("city", "Indonesia")
    start_date = event.get("start_date", "—")
    event_code = event.get("event_code", "EVT-0000")

    story.append(Paragraph(event_title, styles["DocHeroTitle"]))
    story.append(
        Paragraph(
            f"KODE EVENT: {event_code} · {city.upper()} · {start_date} · TOTAL MILESTONE: {len(milestones)} JADWAL",
            styles["DocHeroSubtitle"],
        )
    )
    story.append(Spacer(1, 2 * mm))

    # 2. Milestone Summary Totals Box
    total_scheduled = sum(m.get("amount", 0) for m in milestones)
    paid_count = sum(1 for m in milestones if "paid" in str(m.get("status", "")).lower())
    pending_count = len(milestones) - paid_count

    summary_data = [
        [
            Paragraph("TOTAL MILESTONE TERJADWAL", styles["DocKpiLabel"]),
            Paragraph("MILESTONE TERSELESAIKAN", styles["DocKpiLabel"]),
            Paragraph("MILESTONE MENUNGGU PROSES", styles["DocKpiLabel"]),
            Paragraph("STATUS OPERASIONAL", styles["DocKpiLabel"]),
        ],
        [
            Paragraph(_rp(total_scheduled), styles["DocKpiValueDominant"]),
            Paragraph(f"{paid_count} dari {len(milestones)} termin", styles["DocKpiValue"]),
            Paragraph(f"{pending_count} termin pending", styles["DocKpiValue"]),
            Paragraph("ACTIVE TRACKING", styles["DocKpiValue"]),
        ],
    ]
    summary_table = Table(summary_data, colWidths=[54 * mm, 42 * mm, 42 * mm, 42 * mm])
    summary_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), COLOR_SURFACE_CARD),
        ("BOX", (0, 0), (-1, -1), 0.8, COLOR_BORDER_STRONG),
        ("INNERGRID", (0, 0), (-1, -1), 0.4, COLOR_BORDER),
        ("PADDING", (0, 0), (-1, -1), 2.5 * mm),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ]))
    story.append(summary_table)
    story.append(Spacer(1, 4 * mm))

    # 3. Multi-Page Milestone Table
    story.append(Paragraph("JADWAL MILESTONE & TERMIN PEMBAYARAN", styles["DocSectionHeading"]))
    story.append(Spacer(1, 1 * mm))

    table_rows = [
        [
            Paragraph("PENERIMA / RECIPIENT", styles["DocTH"]),
            Paragraph("DESKRIPSI MILESTONE", styles["DocTH"]),
            Paragraph("STATUS", styles["DocTH"]),
            Paragraph("JATUH TEMPO", styles["DocTH"]),
            Paragraph("TERMIN (%)", styles["DocTHRight"]),
            Paragraph("JUMLAH (IDR)", styles["DocTHRight"]),
        ]
    ]

    for m in milestones:
        status_raw = str(m.get("status", "pending")).upper()
        if "PAID" in status_raw:
            status_text = "PAID"
        elif "PENDING" in status_raw:
            status_text = "PENDING"
        elif "OVERDUE" in status_raw:
            status_text = "OVERDUE"
        else:
            status_text = status_raw

        recipient = str(m.get("ref_name") or "—")
        desc = str(m.get("description") or "—")
        due_date = str(m.get("due_date") or "—")
        pct = f"{m.get('percentage', 0)}%"
        amount_str = _rp(m.get("amount", 0))

        table_rows.append([
            Paragraph(recipient, styles["DocTDBold"]),
            Paragraph(desc, styles["DocTD"]),
            Paragraph(status_text, styles["DocTDMono"]),
            Paragraph(due_date, styles["DocTDMono"]),
            Paragraph(pct, styles["DocTDRight"]),
            Paragraph(amount_str, styles["DocTDRight"]),
        ])

    # Total Row
    table_rows.append([
        Paragraph("TOTAL KESELURUHAN", styles["DocTDBold"]),
        Paragraph(f"{len(milestones)} milestone terjadwal", styles["DocTD"]),
        Paragraph("", styles["DocTD"]),
        Paragraph("", styles["DocTD"]),
        Paragraph("100%", styles["DocTDRightBold"]),
        Paragraph(_rp(total_scheduled), styles["DocTDRightBold"]),
    ])

    ms_table = Table(
        table_rows,
        colWidths=[40 * mm, 52 * mm, 20 * mm, 22 * mm, 18 * mm, 28 * mm],
        repeatRows=1,
    )
    ms_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), COLOR_SURFACE_MUTED),
        ("LINEBELOW", (0, 0), (-1, 0), 1.0, COLOR_BORDER_STRONG),
        ("LINEBELOW", (0, 1), (-1, -2), 0.3, COLOR_BORDER),
        ("LINEABOVE", (0, -1), (-1, -1), 1.0, COLOR_BORDER_STRONG),
        ("BACKGROUND", (0, -1), (-1, -1), COLOR_SURFACE_CARD),
        ("PADDING", (0, 0), (-1, -1), 1.6 * mm),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ]))
    story.append(ms_table)

    def on_first_page(canvas_obj, doc_obj):
        canvas_obj.doc_type = "PAYMENT SCHEDULE"
        canvas_obj.doc_code = f"SCHED-{event.get('event_code', 'EVT-0000')}"
        canvas_obj.event_code = event.get("event_code", "")
        canvas_obj.event_name = event_title

    doc.build(
        story,
        canvasmaker=OkkaxDocumentCanvas,
        onFirstPage=on_first_page,
    )
    buf.seek(0)
    return buf.getvalue()


# -----------------------------------------------------------------------------
# 6. Invoice & Ticket Receipt Document Builder
# -----------------------------------------------------------------------------
def build_invoice_pdf(order: dict, payment: dict, tickets: List[dict]) -> bytes:
    """Build standardized OKKAX Invoice & E-Ticket Receipt PDF."""
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=A4,
        leftMargin=MARGIN_LEFT,
        rightMargin=MARGIN_RIGHT,
        topMargin=MARGIN_TOP,
        bottomMargin=MARGIN_BOTTOM,
    )
    styles = get_okkax_doc_styles()
    story = []

    order_code = order.get("order_code", "ORD-0000")
    event_name = order.get("event_name", "Event Untitled")
    buyer_name = order.get("buyer_name", "Penonton OKKAX")
    buyer_email = order.get("buyer_email", "—")
    created_at = (order.get("created_at") or datetime.now(timezone.utc).isoformat())[:10]

    story.append(Paragraph(f"INVOICE & RECEIPT #{order_code}", styles["DocHeroTitle"]))
    story.append(
        Paragraph(
            f"EVENT: {event_name.upper()} · DITERBITKAN: {created_at} · STATUS: LUNAS (PAID)",
            styles["DocHeroSubtitle"],
        )
    )
    story.append(Spacer(1, 2 * mm))

    # Buyer & Payment Meta Box
    method = payment.get("method_channel") or order.get("payment_method") or "Sandbox Transfer"
    ref_no = payment.get("reference_number") or f"REF-{order_code}"
    tier_info = f"{order.get('tier_name', 'Regular')} × {order.get('quantity', 1)} Tiket"

    meta_data = [
        [
            Paragraph("DITAGIHKAN KEPADA", styles["DocMetaKey"]),
            Paragraph("TIKET & JUMLAH", styles["DocMetaKey"]),
            Paragraph("METODE PEMBAYARAN", styles["DocMetaKey"]),
            Paragraph("NOMOR REFERENSI", styles["DocMetaKey"]),
        ],
        [
            Paragraph(f"{buyer_name}<br/>{buyer_email}", styles["DocMetaVal"]),
            Paragraph(tier_info, styles["DocMetaVal"]),
            Paragraph(method, styles["DocMetaVal"]),
            Paragraph(ref_no, styles["DocMetaVal"]),
        ],
    ]
    meta_table = Table(meta_data, colWidths=[54 * mm, 42 * mm, 42 * mm, 42 * mm])
    meta_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), COLOR_SURFACE_MUTED),
        ("BOX", (0, 0), (-1, -1), 0.6, COLOR_BORDER),
        ("INNERGRID", (0, 0), (-1, -1), 0.4, COLOR_BORDER),
        ("PADDING", (0, 0), (-1, -1), 2.5 * mm),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ]))
    story.append(meta_table)
    story.append(Spacer(1, 4 * mm))

    # Cost Breakdown Table
    story.append(Paragraph("RINCIAN PEMBAYARAN", styles["DocSectionHeading"]))
    story.append(Spacer(1, 1 * mm))

    gross = order.get("gross", 0)
    platform_fee = order.get("platform_fee", 0)
    tax = order.get("tax", 0)
    total = order.get("total", 0)

    bill_rows = [
        [
            Paragraph("ITEM DESKRIPSI", styles["DocTH"]),
            Paragraph("KUANTITAS", styles["DocTH"]),
            Paragraph("SUBTOTAL (IDR)", styles["DocTHRight"]),
        ],
        [
            Paragraph(f"Tiket Masuk: {order.get('tier_name', 'General')} ({event_name})", styles["DocTDBold"]),
            Paragraph(f"{order.get('quantity', 1)} pax", styles["DocTD"]),
            Paragraph(_rp(gross), styles["DocTDRight"]),
        ],
        [
            Paragraph("Biaya Layanan Platform OKKAX (3%)", styles["DocTD"]),
            Paragraph("1 trans", styles["DocTD"]),
            Paragraph(_rp(platform_fee), styles["DocTDRight"]),
        ],
        [
            Paragraph("Estimasi Pajak Hiburan & PPN (11%)", styles["DocTD"]),
            Paragraph("1 trans", styles["DocTD"]),
            Paragraph(_rp(tax), styles["DocTDRight"]),
        ],
        [
            Paragraph("TOTAL PEMBAYARAN", styles["DocTDBold"]),
            Paragraph("", styles["DocTDBold"]),
            Paragraph(_rp(total), styles["DocTDRightBold"]),
        ],
    ]
    bill_table = Table(bill_rows, colWidths=[100 * mm, 30 * mm, 50 * mm])
    bill_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), COLOR_SURFACE_MUTED),
        ("LINEBELOW", (0, 0), (-1, 0), 1.0, COLOR_BORDER_STRONG),
        ("LINEBELOW", (0, 1), (-1, -2), 0.3, COLOR_BORDER),
        ("LINEABOVE", (0, -1), (-1, -1), 1.0, COLOR_BORDER_STRONG),
        ("BACKGROUND", (0, -1), (-1, -1), COLOR_SURFACE_CARD),
        ("PADDING", (0, 0), (-1, -1), 2 * mm),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ]))
    story.append(bill_table)
    story.append(Spacer(1, 5 * mm))

    # Issued Tickets Table
    story.append(Paragraph(f"E-TIKET DITERBITKAN ({len(tickets)} TIKET)", styles["DocSectionHeading"]))
    story.append(Spacer(1, 1 * mm))

    tix_rows = [
        [
            Paragraph("NOMOR TIKET", styles["DocTH"]),
            Paragraph("NAMA PEMEGANG TIKET", styles["DocTH"]),
            Paragraph("TIER TIKET", styles["DocTH"]),
            Paragraph("STATUS VALIDASI", styles["DocTHRight"]),
        ]
    ]

    for t in tickets:
        tno = t.get("ticket_number", "OKX-TIX-000000")
        att = t.get("attendee_name", buyer_name)
        tier_n = t.get("tier_name", order.get("tier_name", "Regular"))
        status_t = str(t.get("status", "valid")).upper()
        tix_rows.append([
            Paragraph(tno, styles["DocTDMono"]),
            Paragraph(att, styles["DocTDBold"]),
            Paragraph(tier_n, styles["DocTD"]),
            Paragraph(status_t, styles["DocTDRight"]),
        ])

    tix_table = Table(tix_rows, colWidths=[48 * mm, 64 * mm, 38 * mm, 30 * mm], repeatRows=1)
    tix_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), COLOR_SURFACE_MUTED),
        ("LINEBELOW", (0, 0), (-1, 0), 1.0, COLOR_BORDER_STRONG),
        ("LINEBELOW", (0, 1), (-1, -1), 0.3, COLOR_BORDER),
        ("PADDING", (0, 0), (-1, -1), 1.8 * mm),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ]))
    story.append(tix_table)

    def on_first_page(canvas_obj, doc_obj):
        canvas_obj.doc_type = "INVOICE & RECEIPT"
        canvas_obj.doc_code = f"INV-{order_code}"
        canvas_obj.event_code = order.get("event_id", "")
        canvas_obj.event_name = event_name

    doc.build(
        story,
        canvasmaker=OkkaxDocumentCanvas,
        onFirstPage=on_first_page,
    )
    buf.seek(0)
    return buf.getvalue()
