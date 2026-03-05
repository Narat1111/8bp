from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from database import get_db
from models.models import Product, User
from schemas.schemas import ProductCreate, ProductUpdate, ProductResponse, ProductAdminResponse
from utils.auth import get_current_user, get_current_admin

router = APIRouter(prefix="/products", tags=["Products"])


@router.get("/", response_model=List[ProductResponse])
def get_products(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    search: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    """Get all active products (public endpoint)."""
    query = db.query(Product).filter(Product.is_active == True)
    if search:
        query = query.filter(Product.title.ilike(f"%{search}%"))
    return query.offset(skip).limit(limit).all()


@router.get("/{product_id}", response_model=ProductResponse)
def get_product(product_id: int, db: Session = Depends(get_db)):
    """Get single product by ID."""
    product = db.query(Product).filter(
        Product.id == product_id,
        Product.is_active == True
    ).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return product


# ─── Admin Endpoints ─────────────────────────────────────────────────────────

@router.get("/admin/all", response_model=List[ProductAdminResponse])
def admin_get_all_products(
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin)
):
    """Admin: Get all products including inactive."""
    return db.query(Product).all()


@router.post("/admin/create", response_model=ProductAdminResponse)
def admin_create_product(
    product_data: ProductCreate,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin)
):
    """Admin: Create a new product."""
    product = Product(**product_data.dict())
    db.add(product)
    db.commit()
    db.refresh(product)
    return product


@router.put("/admin/{product_id}", response_model=ProductAdminResponse)
def admin_update_product(
    product_id: int,
    product_data: ProductUpdate,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin)
):
    """Admin: Update a product."""
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    update_data = product_data.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(product, key, value)

    db.commit()
    db.refresh(product)
    return product


@router.delete("/admin/{product_id}")
def admin_delete_product(
    product_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin)
):
    """Admin: Permanently delete a product and all of its associated orders."""
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    from models.models import Order, Payment

    try:
        # Find all orders for this product
        orders = db.query(Order).filter(Order.product_id == product_id).all()
        payment_ids = [order.payment_id for order in orders if order.payment_id]

        # 1. Delete the orders
        db.query(Order).filter(Order.product_id == product_id).delete(synchronize_session=False)

        # 2. Delete the associated payments
        if payment_ids:
            db.query(Payment).filter(Payment.id.in_(payment_ids)).delete(synchronize_session=False)

        # 3. Delete the product itself
        db.delete(product)
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Database error during deletion: {str(e)}")

    return {"message": "Product deleted successfully"}
