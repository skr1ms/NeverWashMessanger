from database.connection import get_db_connection
from auth.utils import hash_password
from utils.helpers import generate_invite_hash

def get_user_by_id(user_id):
    """Get user data by ID"""
    conn = get_db_connection()
    cur = conn.cursor()
    
    try:
        cur.execute("""
            SELECT id, name, avatar_id
            FROM user_data
            WHERE id = %s
        """, (user_id,))
        
        user = cur.fetchone()
        if user:
            return {
                'id': user[0],
                'name': user[1],
                'avatar_id': user[2]
            }
        return None
    except Exception as e:
        print(f"Error getting user by ID: {e}")
        return None
    finally:
        cur.close()
        conn.close()

def get_user_by_name(username):
    """Get user data by username"""
    conn = get_db_connection()
    cur = conn.cursor()
    
    try:
        cur.execute("""
            SELECT id, name, avatar_id, password_hash
            FROM user_data
            WHERE name = %s
        """, (username,))
        
        user = cur.fetchone()
        if user:
            return {
                'id': user[0],
                'name': user[1],
                'avatar_id': user[2],
                'password_hash': user[3]
            }
        return None
    except Exception as e:
        print(f"Error getting user by name: {e}")
        return None
    finally:
        cur.close()
        conn.close()

def create_user(username, password, invite_code):
    """Create a new user with invitation code"""
    conn = get_db_connection()
    cur = conn.cursor()
    
    try:
        # Check if username exists
        cur.execute("SELECT id FROM user_data WHERE name = %s", (username,))
        if cur.fetchone():
            return None, "Username already exists"

        # Check invite code
        inviter_info = check_invite_code(invite_code)
        if not inviter_info:
            return None, "Invalid invitation code"
            
        inviter_id, used_hash_type = inviter_info
        if not used_hash_type:
            return None, "Invitation code already used"
        
        # Create user
        password_hash = hash_password(password)
        new_invite1 = generate_invite_hash()
        new_invite2 = generate_invite_hash()
        
        cur.execute("""
            INSERT INTO user_data
            (name, password_hash, hash_for_invite_first, hash_for_invite_second)
            VALUES (%s, %s, %s, %s)
            RETURNING id
        """, (username, password_hash, new_invite1, new_invite2))
        
        new_user_id = cur.fetchone()[0]
        
        # Update inviter's used hash
        update_column = 'hash_for_invite_first_used' if used_hash_type == 'first' else 'hash_for_invite_second_used'
        cur.execute(f"""
            UPDATE user_data
            SET {update_column} = TRUE
            WHERE id = %s
        """, (inviter_id,))
        
        # Record invite relationship
        cur.execute("""
            INSERT INTO user_invites
            (inviter_id, invitee_id, invite_hash)
            VALUES (%s, %s, %s)
        """, (inviter_id, new_user_id, invite_code))
        
        conn.commit()
        return new_user_id, None
    except Exception as e:
        conn.rollback()
        print(f"Error creating user: {e}")
        return None, str(e)
    finally:
        cur.close()
        conn.close()

def check_invite_code(invite_code):
    """Check if invitation code is valid and return inviter ID and used hash type"""
    conn = get_db_connection()
    cur = conn.cursor()
    
    try:
        cur.execute("""
            SELECT id,
                   hash_for_invite_first,
                   hash_for_invite_second,
                   hash_for_invite_first_used,
                   hash_for_invite_second_used
            FROM user_data
            WHERE hash_for_invite_first = %s OR hash_for_invite_second = %s
        """, (invite_code, invite_code))
        
        inviter = cur.fetchone()
        if not inviter:
            return None
            
        inviter_id, hash1, hash2, used1, used2 = inviter
        used_hash_type = None
        
        if invite_code == hash1 and not used1:
            used_hash_type = 'first'
        elif invite_code == hash2 and not used2:
            used_hash_type = 'second'
            
        return (inviter_id, used_hash_type)
    except Exception as e:
        print(f"Error checking invite code: {e}")
        return None
    finally:
        cur.close()
        conn.close()

def update_user_avatar(user_id, avatar_id):
    """Update user's avatar"""
    conn = get_db_connection()
    cur = conn.cursor()
    
    try:
        cur.execute("""
            UPDATE user_data
            SET avatar_id = %s
            WHERE id = %s
            RETURNING name
        """, (avatar_id, user_id))
        
        result = cur.fetchone()
        conn.commit()
        
        if result:
            return {'username': result[0]}
        return None
    except Exception as e:
        conn.rollback()
        print(f"Error updating avatar: {e}")
        return None
    finally:
        cur.close()
        conn.close()

def get_user_invite_codes(user_id):
    """Get user's invitation codes"""
    conn = get_db_connection()
    cur = conn.cursor()
    
    try:
        cur.execute("""
            SELECT hash_for_invite_first, hash_for_invite_second
            FROM user_data
            WHERE id = %s
        """, (user_id,))
        
        codes = cur.fetchone()
        if codes:
            return {
                'code1': codes[0],
                'code2': codes[1]
            }
        return None
    except Exception as e:
        print(f"Error getting invite codes: {e}")
        return None
    finally:
        cur.close()
        conn.close()

def delete_user_account(user_id):
    """Delete a user account and handle invitations"""
    conn = get_db_connection()
    cur = conn.cursor()
    
    try:
        # First get the user's information
        cur.execute("""
            SELECT name FROM user_data WHERE id = %s
        """, (user_id,))
        username = cur.fetchone()[0]

        # Find who invited this user and which hash was used
        cur.execute("""
            SELECT inviter_id, invite_hash
            FROM user_invites
            WHERE invitee_id = %s
        """, (user_id,))

        invite_info = cur.fetchone()
        if invite_info:
            inviter_id, invite_hash = invite_info

            # Check which invite code was used (first or second)
            cur.execute("""
                SELECT 
                    CASE WHEN hash_for_invite_first = %s THEN 'first'
                         WHEN hash_for_invite_second = %s THEN 'second'
                         ELSE NULL
                    END AS used_hash_type
                FROM user_data
                WHERE id = %s
            """, (invite_hash, invite_hash, inviter_id))

            result = cur.fetchone()
            if result and result[0]:
                used_hash_type = result[0]

                # Generate a new invite code
                new_invite_hash = generate_invite_hash()

                # Update the corresponding hash depending on which one was used
                if used_hash_type == 'first':
                    cur.execute("""
                        UPDATE user_data
                        SET hash_for_invite_first = %s, 
                            hash_for_invite_first_used = FALSE
                        WHERE id = %s
                    """, (new_invite_hash, inviter_id))
                else:  # 'second'
                    cur.execute("""
                        UPDATE user_data
                        SET hash_for_invite_second = %s, 
                            hash_for_invite_second_used = FALSE
                        WHERE id = %s
                    """, (new_invite_hash, inviter_id))

        # Delete the invitation record
        cur.execute("DELETE FROM user_invites WHERE invitee_id = %s OR inviter_id = %s",
                    (user_id, user_id))

        # Delete the user's messages
        cur.execute("DELETE FROM messages WHERE sender_id = %s OR receiver_id = %s",
                    (user_id, user_id))

        # Delete the user's data
        cur.execute("DELETE FROM user_data WHERE id = %s", (user_id,))

        conn.commit()
        return True
    except Exception as e:
        conn.rollback()
        print(f"Error deleting account: {e}")
        return False
    finally:
        cur.close()
        conn.close()