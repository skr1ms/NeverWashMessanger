import psycopg2
from config import Config

def get_db_connection():
    """Create and return a database connection"""
    conn = psycopg2.connect(
        host=Config.DB_HOST,
        port=Config.DB_PORT,
        dbname=Config.DB_NAME,
        user=Config.DB_USER,
        password=Config.DB_PASSWORD
    )
    conn.autocommit = True
    return conn

def init_db():
    """Initialize database tables if they don't exist"""
    conn = get_db_connection()
    cur = conn.cursor()
    
    try:
        # Create user_data table
        cur.execute('''
            CREATE TABLE IF NOT EXISTS user_data (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) NOT NULL UNIQUE,
                password_hash VARCHAR(64) NOT NULL,
                avatar_id INTEGER NOT NULL DEFAULT 1,
                hash_for_invite_first VARCHAR(64) NOT NULL,
                hash_for_invite_second VARCHAR(64) NOT NULL,
                hash_for_invite_first_used BOOLEAN NOT NULL DEFAULT FALSE,
                hash_for_invite_second_used BOOLEAN NOT NULL DEFAULT FALSE
            );
        ''')

        # Create messages table
        cur.execute('''
            CREATE TABLE IF NOT EXISTS messages (
                id SERIAL PRIMARY KEY,
                sender_id INTEGER NOT NULL REFERENCES user_data(id),
                receiver_id INTEGER NOT NULL REFERENCES user_data(id),
                content TEXT NOT NULL,
                timestamp TIMESTAMP NOT NULL DEFAULT NOW()
            );
        ''')

        # Create user_invites table
        cur.execute('''
            CREATE TABLE IF NOT EXISTS user_invites (
                id SERIAL PRIMARY KEY,
                inviter_id INTEGER NOT NULL REFERENCES user_data(id),
                invitee_id INTEGER NOT NULL REFERENCES user_data(id),
                invite_hash VARCHAR(64) NOT NULL,
                timestamp TIMESTAMP NOT NULL DEFAULT NOW()
            );
        ''')
        
        print("Database initialized successfully")
    except Exception as e:
        print(f"Error initializing database: {e}")
    finally:
        cur.close()
        conn.close()