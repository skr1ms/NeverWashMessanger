import hashlib
import re

def hash_password(password):
    """Hash a password using SHA-256"""
    return hashlib.sha256(password.encode()).hexdigest()

def validate_username(username):
    """Validate username format"""
    return re.match(r'^@[a-zA-Z0-9_]{3,}$', username) is not None

def validate_password(password):
    """Validate password strength"""
    return len(password) >= 8 and re.search(r'[!@#$%^&*(),.?":{}|<>]', password) is not None