import httpx
import hashlib
import uuid
import qrcode
import qrcode.image.svg
import io
import base64
import os
from dotenv import load_dotenv
from typing import Optional

load_dotenv()

BAKONG_API_TOKEN = os.getenv("BAKONG_API_TOKEN", "")
BAKONG_ACCOUNT = os.getenv("BAKONG_ACCOUNT", "chheak_narat@bkrt")
MERCHANT_NAME = os.getenv("MERCHANT_NAME", "NARAT CHHEAK")
BAKONG_API_URL = os.getenv("BAKONG_API_URL", "https://api-bakong.nbc.gov.kh/v1")


def generate_transaction_id() -> str:
    """Generate a unique transaction ID."""
    return str(uuid.uuid4()).replace("-", "")[:20].upper()


from bakong_khqr import KHQR

khqr_client = KHQR()

def build_khqr_string(
    amount: float,
    transaction_id: str,
    currency: str = "USD",
    memo: str = "Digital Product"
) -> str:
    """
    Generate KHQR string using the native Python SDK.
    This ensures 100% compliance with Cambodia's KHQR standard.
    """
    # The official SDK takes care of TLV packaging and CRC-16 computation.
    qr_string = khqr_client.create_qr(
        bank_account=BAKONG_ACCOUNT,
        merchant_name=MERCHANT_NAME,
        merchant_city="Phnom Penh",
        amount=amount,
        currency=currency,
        store_label=memo[:25],
        phone_number="",
        bill_number=transaction_id[:25],
        terminal_label="1"
    )
    return qr_string


def generate_qr_image_base64(qr_data: str) -> str:
    """Generate QR code image and return as base64 PNG."""
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_M,
        box_size=8,
        border=4,
    )
    qr.add_data(qr_data)
    qr.make(fit=True)

    img = qr.make_image(fill_color="black", back_color="white")
    buffer = io.BytesIO()
    img.save(buffer, format="PNG")
    buffer.seek(0)
    return base64.b64encode(buffer.getvalue()).decode("utf-8")


def compute_md5(transaction_id: str) -> str:
    """Compute MD5 hash for payment verification."""
    return hashlib.md5(transaction_id.encode()).hexdigest()


async def check_payment_via_bakong_api(md5_hash: str) -> dict:
    """
    Check payment status using Bakong API.
    Returns dict with 'status' key: 'SUCCESS', 'PENDING', 'FAILED'
    """
    headers = {
        "Authorization": f"Bearer {BAKONG_API_TOKEN}",
        "Content-Type": "application/json",
    }
    payload = {"md5": md5_hash}

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.post(
                f"{BAKONG_API_URL}/check_transaction_by_md5",
                json=payload,
                headers=headers,
            )
            if response.status_code == 200:
                data = response.json()
                # Bakong returns responseCode 0 for success
                if data.get("responseCode") == 0:
                    return {"status": "SUCCESS", "data": data}
                else:
                    return {
                        "status": "PENDING",
                        "message": data.get("responseMessage", "Payment not found")
                    }
            else:
                return {"status": "PENDING", "message": f"API returned {response.status_code}"}
    except Exception as e:
        return {"status": "ERROR", "message": str(e)}


def create_payment_data(
    amount: float,
    product_title: str,
    currency: str = "USD"
) -> dict:
    """Create all payment-related data for a transaction."""
    transaction_id = generate_transaction_id()
    memo = f"Buy: {product_title[:20]}"
    qr_string = build_khqr_string(amount, transaction_id, currency, memo)
    qr_image = generate_qr_image_base64(qr_string)
    md5_hash = compute_md5(transaction_id)

    return {
        "transaction_id": transaction_id,
        "qr_code_data": qr_string,
        "qr_image_base64": qr_image,
        "md5_hash": md5_hash,
        "amount": amount,
        "currency": currency,
    }
