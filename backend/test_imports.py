import sys
sys.path.insert(0, '.')
from database import Base, engine, create_database_if_not_exists
from models.models import User, Product, Order, Payment
from routers import auth, products, payment, orders
from services.bakong_payment import create_payment_data

print("All imports successful!")
data = create_payment_data(9.99, "Test Product")
print("KHQR generation OK")
print(f"  Transaction ID: {data['transaction_id']}")
print(f"  QR string length: {len(data['qr_code_data'])} chars")
print(f"  QR image base64 length: {len(data['qr_image_base64'])} chars")
print(f"  MD5 hash: {data['md5_hash']}")
print("All systems ready!")
