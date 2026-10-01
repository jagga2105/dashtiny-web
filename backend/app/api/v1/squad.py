from fastapi import APIRouter
from pydantic import BaseModel
from typing import List, Optional

router = APIRouter(prefix="/squads", tags=["Squad Co-Exploration & Split Ledger"])

class AddExpenseRequest(BaseModel):
    description: str
    amount: float
    category: str
    paid_by_user_id: str

@router.get("/{squad_id}/summary")
def get_squad_summary(squad_id: str):
    """
    Returns squad members, active votes, total spent, and net balance share.
    """
    return {
        "squad_id": squad_id,
        "room_code": "GOA-2026-X9",
        "total_spent": 23400.0,
        "per_person_share": 5850.0,
        "members": [
            {"id": "user_01", "name": "Kumkum Pandey", "paid": 8500.0, "balance": 2650.0},
            {"id": "user_02", "name": "Aarav Sharma", "paid": 7200.0, "balance": 1350.0},
            {"id": "user_03", "name": "Priya Verma", "paid": 3800.0, "balance": -2050.0},
            {"id": "user_04", "name": "Vikram Sengupta", "paid": 3900.0, "balance": -1950.0}
        ]
    }

@router.post("/{squad_id}/expenses")
def add_expense(squad_id: str, request: AddExpenseRequest):
    return {
        "status": "success",
        "expense": {
            "id": "exp_new_01",
            "description": request.description,
            "amount": request.amount,
            "category": request.category,
            "paid_by": request.paid_by_user_id
        }
    }
