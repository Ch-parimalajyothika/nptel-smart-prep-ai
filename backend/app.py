"""
NPTEL Smart Prep AI — Flask Backend v2
"""
import os
from flask import Flask, jsonify
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from dotenv import load_dotenv
load_dotenv()
from reportlab.lib import colors  # <--- Add this line

from routes.auth           import auth_bp
from routes.notes          import notes_bp
from routes.questions      import questions_bp
from routes.upload         import upload_bp
from routes.chat           import chat_bp
from routes.progress       import progress_bp
from routes.courses        import courses_bp
from routes.weeks          import weeks_bp
from routes.exam_analytics import exam_analytics_bp
from routes.pdf_export     import pdf_bp
from database import init_db

def create_app():
    app = Flask(__name__)
    app.config["SECRET_KEY"]               = os.getenv("SECRET_KEY", "dev-secret-change-me")
    app.config["JWT_SECRET_KEY"]           = os.getenv("JWT_SECRET_KEY", "dev-jwt-secret")
    app.config["JWT_ACCESS_TOKEN_EXPIRES"] = False
    app.config["UPLOAD_FOLDER"]            = os.getenv("UPLOAD_FOLDER", "uploads")
    app.config["MAX_CONTENT_LENGTH"]       = int(os.getenv("MAX_CONTENT_MB", 50)) * 1024 * 1024

    CORS(app, resources={r"/api/*": {"origins": "*"}})
    JWTManager(app)
    os.makedirs(app.config["UPLOAD_FOLDER"], exist_ok=True)

    blueprints = [
        (auth_bp,           "/api/auth"),
        (notes_bp,          "/api/notes"),
        (questions_bp,      "/api/questions"),
        (upload_bp,         "/api/upload"),
        (chat_bp,           "/api/chat"),
        (progress_bp,       "/api/progress"),
        (courses_bp,        "/api/courses"),
        (weeks_bp,          "/api/weeks"),
        (exam_analytics_bp, "/api/exam"),
        (pdf_bp,            "/api/pdf"),
    ]
    for bp, prefix in blueprints:
        app.register_blueprint(bp, url_prefix=prefix)

    @app.route("/api/health")
    def health():
        return jsonify({"status": "ok", "version": "2.0"})

    with app.app_context():
        init_db()
    return app

if __name__ == "__main__":
    app = create_app()
    port = int(os.getenv("PORT", 5000))
    print(f"\n✅  NPTEL Smart Prep AI v2 → http://localhost:{port}\n")
    app.run(host="0.0.0.0", port=port, debug=False)
