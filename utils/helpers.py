import hashlib
import os
import string
import secrets

def generate_invite_hash():
    """Generate a random hash for invitation codes"""
    return hashlib.sha256(os.urandom(32)).hexdigest()