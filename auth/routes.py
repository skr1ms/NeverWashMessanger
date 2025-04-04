from flask import Blueprint, request, jsonify, session, render_template
from auth.utils import hash_password, validate_username, validate_password
from database.users import get_user_by_name, create_user, check_invite_code
from database.connection import get_db_connection
from utils.helpers import generate_invite_hash
from chat.socket import active_connections

# Create blueprint
auth_bp = Blueprint('auth', __name__)

@auth_bp.route('/')
def index():
    """Render the authentication page"""
    return render_template('index.html')

@auth_bp.route('/login', methods=['POST'])
def login():
    """Handle user login"""
    data = request.json
    username = data.get('username')
    password = data.get('password')

    if not all([username, password]):
        return jsonify({'error': 'Missing credentials'}), 400

    conn = get_db_connection()
    cur = conn.cursor()

    try:
        cur.execute("""
            SELECT id, password_hash, avatar_id
            FROM user_data
            WHERE name = %s
        """, (username,))
        user = cur.fetchone()

        if user and user[1] == hash_password(password):
            session['user_id'] = user[0]
            return jsonify({
                'message': 'Login successful',
                'avatar_id': user[2]
            }), 200
        else:
            return jsonify({'error': 'Invalid credentials'}), 401

    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        cur.close()
        conn.close()

@auth_bp.route('/register', methods=['POST'])
def register():
    """Handle user registration"""
    data = request.json
    username = data.get('username')
    password = data.get('password')
    invite_code = data.get('invite_code')

    if not all([username, password, invite_code]):
        return jsonify({'error': 'Missing data'}), 400

    if not validate_username(username):
        return jsonify({'error': 'Invalid username format'}), 400

    if not validate_password(password):
        return jsonify({'error': 'Password does not meet requirements'}), 400

    conn = get_db_connection()
    cur = conn.cursor()

    try:
        # Check existing user
        cur.execute("SELECT id FROM user_data WHERE name = %s", (username,))
        if cur.fetchone():
            return jsonify({'error': 'Username already exists'}), 400

        # Validate invite code
        inviter_info = check_invite_code(invite_code)
        if not inviter_info:
            return jsonify({'error': 'Invalid invite code'}), 400
        
        inviter_id, used_hash_type = inviter_info
        
        if not used_hash_type:
            return jsonify({'error': 'Invite code already used'}), 400

        # Create new user
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
        return jsonify({
            'message': 'Registration successful',
            'invite_codes': [new_invite1, new_invite2]
        }), 201

    except Exception as e:
        conn.rollback()
        return jsonify({'error': str(e)}), 500
    finally:
        cur.close()
        conn.close()

@auth_bp.route('/logout', methods=['POST'])
def logout():
    """Handle user logout"""
    if 'user_id' in session:
        conn = get_db_connection()
        cur = conn.cursor()

        try:
            cur.execute("SELECT name FROM user_data WHERE id = %s",
                        (session['user_id'],))
            user_result = cur.fetchone()
            if user_result:
                username = user_result[0]

                # Remove the user from active connections
                if username in active_connections:
                    del active_connections[username]

        except Exception as e:
            print(f"Error during logout: {e}")
        finally:
            cur.close()
            conn.close()

    # Clear the session in any case
    session.clear()
    return jsonify({'message': 'Logged out successfully'}), 200