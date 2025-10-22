from fastapi import HTTPException, status

class TrainingDashboardException(Exception):
    pass

class UserNotFound(TrainingDashboardException):
    pass

class InvalidCredentials(TrainingDashboardException):
    pass

class FitFileProcessingError(TrainingDashboardException):
    pass

class CacheError(TrainingDashboardException):
    pass

# HTTP Exception handlers
def create_http_exception(status_code: int, detail: str):
    return HTTPException(status_code=status_code, detail=detail)

USER_NOT_FOUND = HTTPException(
    status_code=status.HTTP_404_NOT_FOUND,
    detail="User not found"
)

INVALID_CREDENTIALS = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Invalid credentials",
    headers={"WWW-Authenticate": "Bearer"},
)

UNAUTHORIZED = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Not authenticated",
    headers={"WWW-Authenticate": "Bearer"},
)