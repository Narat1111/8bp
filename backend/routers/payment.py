from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models.models import Order, Payment, Product, User, OrderStatus, PaymentStatus
from schemas.schemas import PaymentCreate, PaymentResponse, PaymentVerifyResponse
from services.bakong_payment import create_payment_data, check_payment_via_bakong_api
from utils.auth import get_current_user

router = APIRouter(prefix="/payment", tags=["Payment"])


@router.post("/create", response_model=PaymentResponse)
def create_payment(
    payment_data: PaymentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Create a KHQR payment for a product.
    Returns QR code data for the user to scan.
    """
    # Validate product exists
    product = db.query(Product).filter(
        Product.id == payment_data.product_id,
        Product.is_active == True
    ).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    # Check if user has already purchased this product
    existing_paid = db.query(Order).filter(
        Order.user_id == current_user.id,
        Order.product_id == payment_data.product_id,
        Order.status == OrderStatus.PAID
    ).first()
    if existing_paid:
        raise HTTPException(status_code=400, detail="You have already purchased this product")

    # Create payment data
    payment_info = create_payment_data(
        amount=product.price,
        product_title=product.title,
        currency="USD"
    )

    # Create Payment record
    payment = Payment(
        amount=payment_info["amount"],
        currency=payment_info["currency"],
        payment_method="KHQR",
        status=PaymentStatus.PENDING,
        transaction_id=payment_info["transaction_id"],
        qr_code_data=payment_info["qr_code_data"],
        md5_hash=payment_info["md5_hash"],
    )
    db.add(payment)
    db.flush()

    # Create Order record
    order = Order(
        user_id=current_user.id,
        product_id=payment_data.product_id,
        status=OrderStatus.PENDING,
        payment_id=payment.id,
    )
    db.add(order)
    db.commit()
    db.refresh(payment)
    db.refresh(order)

    return PaymentResponse(
        payment_id=payment.id,
        order_id=order.id,
        qr_code_data=payment_info["qr_code_data"],
        qr_image_base64=payment_info["qr_image_base64"],
        amount=payment_info["amount"],
        currency=payment_info["currency"],
        status=PaymentStatus.PENDING,
        md5_hash=payment_info["md5_hash"],
    )


@router.post("/verify/{payment_id}", response_model=PaymentVerifyResponse)
async def verify_payment(
    payment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Verify payment status via Bakong API.
    If paid, mark order as complete and unlock product.
    """
    # Find payment
    payment = db.query(Payment).filter(Payment.id == payment_id).first()
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")

    # Find associated order for this user
    order = db.query(Order).filter(
        Order.payment_id == payment_id,
        Order.user_id == current_user.id
    ).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    # Already paid
    if payment.status == PaymentStatus.SUCCESS:
        return PaymentVerifyResponse(
            status="SUCCESS",
            message="Payment already confirmed",
            order_id=order.id,
            product_title=order.product.title if order.product else None,
        )

    # Check via Bakong API
    result = await check_payment_via_bakong_api(payment.md5_hash)

    if result["status"] == "SUCCESS":
        # Mark payment as successful
        payment.status = PaymentStatus.SUCCESS
        order.status = OrderStatus.PAID
        db.commit()

        return PaymentVerifyResponse(
            status="SUCCESS",
            message="Payment verified! Your product is now available.",
            order_id=order.id,
            product_title=order.product.title if order.product else None,
        )
    elif result["status"] == "ERROR":
        return PaymentVerifyResponse(
            status="PENDING",
            message="Could not reach payment server. Please try again.",
            order_id=order.id,
        )
    else:
        return PaymentVerifyResponse(
            status="PENDING",
            message="Payment not yet received. Please scan and pay the QR code.",
            order_id=order.id,
        )


@router.get("/status/{payment_id}")
def get_payment_status(
    payment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get payment status quick check."""
    payment = db.query(Payment).filter(Payment.id == payment_id).first()
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")

    order = db.query(Order).filter(Order.payment_id == payment_id).first()

    return {
        "payment_id": payment.id,
        "status": payment.status,
        "amount": payment.amount,
        "currency": payment.currency,
        "order_id": order.id if order else None,
        "order_status": order.status if order else None,
    }
