from flask import jsonify, g, current_app
from werkzeug.exceptions import HTTPException
import structlog
import uuid

logger = structlog.get_logger()

def handle_exception(e):
    """ स्टैंडर्डाइज्ड एरर हैंडलर """
    request_id = g.get("request_id", str(uuid.uuid4()))
    
    if isinstance(e, HTTPException):
        code = e.name.replace(" ", "_").upper()
        message = e.description
        status_code = e.code
    else:
        logger.exception("unhandled_exception", error=str(e), request_id=request_id)
        code = "INTERNAL_SERVER_ERROR"
        message = "An unexpected error occurred. Please try again later."
        status_code = 500

    response = {
        "code": code,
        "message": message,
        "details": getattr(e, "data", {}),
        "request_id": request_id
    }
    
    return jsonify(response), status_code

def init_error_handlers(app):
    app.register_error_handler(Exception, handle_exception)
    app.register_error_handler(HTTPException, handle_exception)
