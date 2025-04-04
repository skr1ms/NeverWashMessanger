from database.connection import get_db_connection

def store_message_db(sender, recipient, text):
    """Store a message in the database and return timestamp"""
    conn = None
    cur = None
    try:
        conn = get_db_connection()
        cur = conn.cursor()

        # Get user IDs
        cur.execute("SELECT id FROM user_data WHERE name = %s", (sender,))
        sender_result = cur.fetchone()
        if not sender_result:
            print(f"Sender {sender} not found")
            return None
        sender_id = sender_result[0]

        cur.execute("SELECT id FROM user_data WHERE name = %s", (recipient,))
        recipient_result = cur.fetchone()
        if not recipient_result:
            print(f"Recipient {recipient} not found")
            return None
        recipient_id = recipient_result[0]

        # Save the message and return timestamp
        cur.execute("""
            INSERT INTO messages (sender_id, receiver_id, content, timestamp)
            VALUES (%s, %s, %s, NOW())
            RETURNING timestamp
        """, (sender_id, recipient_id, text))

        timestamp = cur.fetchone()[0]
        conn.commit()
        print(f"Message stored in database: {sender} -> {recipient}")
        return timestamp.isoformat()

    except Exception as e:
        print(f"Error storing message: {e}")
        if conn:
            conn.rollback()
        return None
    finally:
        if cur:
            cur.close()
        if conn:
            conn.close()

def get_message_history_db(user_id, other_username):
    """Get message history between current user and another user"""
    conn = get_db_connection()
    cur = conn.cursor()

    try:
        # Get current user's name
        cur.execute("SELECT name FROM user_data WHERE id = %s", (user_id,))
        current_user = cur.fetchone()[0]

        # Get other user's ID
        cur.execute("SELECT id FROM user_data WHERE name = %s", (other_username,))
        other_user_id_result = cur.fetchone()

        if not other_user_id_result:
            return []  # User not found

        other_user_id = other_user_id_result[0]

        # Get message history
        cur.execute("""
            SELECT u_sender.name AS sender_name, u_receiver.name AS receiver_name, 
                   m.content, m.timestamp
            FROM messages m
            JOIN user_data u_sender ON m.sender_id = u_sender.id
            JOIN user_data u_receiver ON m.receiver_id = u_receiver.id
            WHERE (m.sender_id = %s AND m.receiver_id = %s) OR 
                  (m.sender_id = %s AND m.receiver_id = %s)
            ORDER BY m.timestamp ASC
        """, (user_id, other_user_id, other_user_id, user_id))

        messages = []
        for row in cur.fetchall():
            sender, receiver, text, timestamp = row
            messages.append({
                'from': sender,
                'to': receiver,
                'text': text,
                'timestamp': timestamp.isoformat()
            })

        return messages

    except Exception as e:
        print(f"Error getting message history: {e}")
        return None
    finally:
        cur.close()
        conn.close()

def get_user_contacts(user_id):
    """Get the list of users the current user has communicated with"""
    conn = get_db_connection()
    cur = conn.cursor()

    try:
        # Find the current user's name
        cur.execute("SELECT name FROM user_data WHERE id = %s", (user_id,))
        current_username = cur.fetchone()[0]

        # Find all users the current user has communicated with
        cur.execute("""
            SELECT DISTINCT 
                CASE 
                    WHEN m.sender_id = %s THEN ud.name
                    ELSE ud_sender.name
                END AS contact_name,
                CASE 
                    WHEN m.sender_id = %s THEN ud.avatar_id
                    ELSE ud_sender.avatar_id
                END AS contact_avatar_id,
                MAX(m.timestamp) as last_message_time
            FROM messages m
            JOIN user_data ud ON m.receiver_id = ud.id
            JOIN user_data ud_sender ON m.sender_id = ud_sender.id
            WHERE m.sender_id = %s OR m.receiver_id = %s
            GROUP BY contact_name, contact_avatar_id
            ORDER BY last_message_time DESC
        """, (user_id, user_id, user_id, user_id))

        contacts = []
        for row in cur.fetchall():
            # Exclude the current user from the contacts list
            contact_name, avatar_id, _ = row
            if contact_name != current_username:
                contacts.append({
                    'username': contact_name,
                    'avatar_id': avatar_id
                })

        return contacts

    except Exception as e:
        print(f"Error getting user contacts: {e}")
        return None
    finally:
        cur.close()
        conn.close()