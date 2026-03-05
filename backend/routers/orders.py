from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from database import get_db
from models.models import Order, Payment, Product, User, OrderStatus, PaymentStatus
from schemas.schemas import OrderResponse, PurchasedProductResponse, DashboardStats
from utils.auth import get_current_user, get_current_admin

router = APIRouter(prefix="/orders", tags=["Orders"])


@router.get("/my", response_model=List[OrderResponse])
def get_my_orders(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get current user's order history."""
    orders = db.query(Order).filter(Order.user_id == current_user.id)\
        .order_by(Order.created_at.desc()).all()
    return orders


@router.get("/my/purchased", response_model=List[PurchasedProductResponse])
def get_purchased_products(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all paid/purchased products for the current user."""
    orders = db.query(Order).filter(
        Order.user_id == current_user.id,
        Order.status == OrderStatus.PAID
    ).order_by(Order.created_at.desc()).all()

    purchased = []
    for order in orders:
        if order.product:
            purchased.append(PurchasedProductResponse(
                order_id=order.id,
                product_id=order.product.id,
                product_title=order.product.title,
                product_description=order.product.description,
                account_email=order.product.account_email or "N/A",
                account_password=order.product.account_password or "N/A",
                purchased_at=order.created_at,
            ))
    return purchased


# ─── Admin Order Endpoints ────────────────────────────────────────────────────

@router.get("/admin/all")
def admin_get_all_orders(
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin)
):
    """Admin: Get all orders with user and product details."""
    orders = db.query(Order).order_by(Order.created_at.desc()).all()
    result = []
    for order in orders:
        result.append({
            "id": order.id,
            "user_id": order.user_id,
            "username": order.user.username if order.user else "N/A",
            "user_email": order.user.email if order.user else "N/A",
            "product_id": order.product_id,
            "product_title": order.product.title if order.product else "N/A",
            "product_price": order.product.price if order.product else 0,
            "status": order.status,
            "payment_id": order.payment_id,
            "created_at": order.created_at,
        })
    return result


@router.get("/admin/stats", response_model=DashboardStats)
def admin_dashboard_stats(
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin)
):
    """Admin: Get dashboard statistics."""
    total_users = db.query(User).filter(User.is_admin == False).count()
    total_products = db.query(Product).filter(Product.is_active == True).count()
    total_orders = db.query(Order).count()
    paid_orders = db.query(Order).filter(Order.status == OrderStatus.PAID).count()
    pending_orders = db.query(Order).filter(Order.status == OrderStatus.PENDING).count()

    # Sum revenue from paid orders
    paid_order_list = db.query(Order).filter(Order.status == OrderStatus.PAID).all()
    total_revenue = sum(
        (order.product.price if order.product else 0)
        for order in paid_order_list
    )

    return DashboardStats(
        total_users=total_users,
        total_products=total_products,
        total_orders=total_orders,
        total_revenue=total_revenue,
        pending_orders=pending_orders,
        paid_orders=paid_orders,
    )


@router.get("/admin/users")
def admin_get_all_users(
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin)
):
    """Admin: Get all registered users."""
    users = db.query(User).order_by(User.created_at.desc()).all()
    return [
        {
            "id": u.id,
            "username": u.username,
            "email": u.email,
            "is_admin": u.is_admin,
            "is_active": u.is_active,
            "created_at": u.created_at,
            "order_count": len(u.orders),
        }
        for u in users
    ]


@router.put("/admin/user/{user_id}/toggle")
def admin_toggle_user_status(
    user_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin)
):
    """Admin: Toggle user active status."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.is_admin:
        raise HTTPException(status_code=400, detail="Cannot deactivate admin accounts")
    user.is_active = not user.is_active
    db.commit()
    return {"message": f"User {'activated' if user.is_active else 'deactivated'}", "is_active": user.is_active}
