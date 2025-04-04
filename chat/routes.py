from flask import Blueprint, request, jsonify, session, render_template
from database.users import get_user_by_id, get_user_by_name, update_user_avatar, get_user_invite_codes, delete_user_account
from database.messages import get_message_history_db, get_user_contacts
from database.connection import get_db_connection

# Create blueprint
chat_bp = Blueprint('chat', __name__)

@chat_bp.route('/chat')
def chat():
    """Render the chat page"""
    return render_template('chat.html')

@chat_bp.route('/get-user-info', methods=['GET'])
def get_user_info():
    """Get current user information"""
    if 'user_id' not in session:
        return jsonify({'error': 'Not logged in'}), 401

    user = get_user_by_id(session['user_id'])
    if not user:
        return jsonify({'error': 'User not found'}), 404

    return jsonify({
        'username': user['name'],
        'avatar_id': user['avatar_id']
    }), 200

@chat_bp.route('/search-users', methods=['GET'])
def search_users():
    """Search for users by name"""
    query = request.args.get('query', '').strip()
    if not query or len(query) < 3:
        return jsonify({'users': []}), 200

    conn = get_db_connection()
    cur = conn.cursor()

    try:
        # Search for users with name containing the query
        cur.execute("""
            SELECT name, avatar_id
            FROM user_data
            WHERE name LIKE %s AND id != %s
            LIMIT 10
        """, (f"%{query}%", session.get('user_id')))

        users = [{'username': row[0], 'avatar_id': row[1]}
                for row in cur.fetchall()]
        return jsonify({'users': users}), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        cur.close()
        conn.close()

@chat_bp.route('/get-inviter-info', methods=['GET'])
def get_inviter_info():
    """Get information about the user who invited the current user"""
    if 'user_id' not in session:
        return jsonify({'error': 'Not logged in'}), 401

    conn = get_db_connection()
    cur = conn.cursor()

    try:
        # Get the current user's name
        cur.execute("SELECT name FROM user_data WHERE id = %s",
                    (session['user_id'],))
        username = cur.fetchone()[0]

        # Find who invited the current user
        cur.execute("""
            SELECT ud.name, ud.avatar_id
            FROM user_invites ui
            JOIN user_data ud ON ui.inviter_id = ud.id
            WHERE ui.invitee_id = %s
        """, (session['user_id'],))

        inviter = cur.fetchone()
        if not inviter:
            return jsonify({'found': False, 'username': username}), 200

        return jsonify({
            'found': True,
            'username': username,
            'inviter_name': inviter[0],
            'inviter_avatar_id': inviter[1]
        }), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        cur.close()
        conn.close()

@chat_bp.route('/update-avatar', methods=['POST'])
def update_avatar():
    """Update user's avatar"""
    if 'user_id' not in session:
        return jsonify({'error': 'Not logged in'}), 401

    data = request.json
    avatar_id = data.get('avatar_id')

    if not avatar_id:
        return jsonify({'error': 'Missing avatar ID'}), 400

    if not (1 <= avatar_id <= 20):
        return jsonify({'error': 'Invalid avatar ID'}), 400

    result = update_user_avatar(session['user_id'], avatar_id)
    if not result:
        return jsonify({'error': 'Failed to update avatar'}), 500

    return jsonify({
        'message': 'Avatar updated successfully',
        'username': result['username'],
        'avatar_id': avatar_id
    }), 200

@chat_bp.route('/get-invite-codes', methods=['GET'])
def get_invite_codes():
    """Get user's invitation codes"""
    if 'user_id' not in session:
        return jsonify({'error': 'Not logged in'}), 401

    codes = get_user_invite_codes(session['user_id'])
    if not codes:
        return jsonify({'error': 'Failed to get invitation codes'}), 500

    return jsonify(codes), 200

@chat_bp.route('/delete-account', methods=['POST'])
def delete_account():
    """Delete user account"""
    if 'user_id' not in session:
        return jsonify({'error': 'Not logged in'}), 401

    success = delete_user_account(session['user_id'])
    if not success:
        return jsonify({'error': 'Failed to delete account'}), 500

    # Clear the session
    session.clear()
    return jsonify({'message': 'Account deleted successfully'}), 200

@chat_bp.route('/chat-connect', methods=['POST'])
def chat_connect():
    """Endpoint for getting WebSocket connection information"""
    if 'user_id' not in session:
        return jsonify({'error': 'Not logged in'}), 401

    # Use the current host and port for WebSocket
    host = request.host.split(':')[0]  # Get host without port
    # Use port from request or 5000 by default
    port = request.host.split(':')[1] if ':' in request.host else 5000

    return jsonify({
        'host': host,
        'port': port,
        'user_id': session['user_id']
    }), 200

@chat_bp.route('/get-message-history', methods=['GET'])
def get_message_history():
    """Get message history between two users"""
    if 'user_id' not in session:
        return jsonify({'error': 'Not logged in'}), 401

    other_user = request.args.get('username')
    if not other_user:
        return jsonify({'error': 'Missing username'}), 400

    messages = get_message_history_db(session['user_id'], other_user)
    if messages is None:  # None indicates an error
        return jsonify({'error': 'Failed to get message history'}), 500

    return jsonify({'messages': messages}), 200

@chat_bp.route('/get-contacts', methods=['GET'])
def get_contacts():
    """Get the list of users the current user has communicated with"""
    if 'user_id' not in session:
        return jsonify({'error': 'Not logged in'}), 401

    contacts = get_user_contacts(session['user_id'])
    if contacts is None:  # None indicates an error
        return jsonify({'error': 'Failed to get contacts'}), 500

    return jsonify({'contacts': contacts}), 200