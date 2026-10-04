"""
DashTiny Notification Service
Handles persistent notification delivery for squad invites, applicant reviews,
friend graph requests, and collaborative itinerary revisions.
"""
from typing import Optional, Dict, Any, List
from sqlalchemy.orm import Session
from app.models.models import Notification, User, Itinerary, SquadRoom, SquadMember


class NotificationService:
    @staticmethod
    def create_notification(
        db: Session,
        user_id: str,
        type: str,
        title: str,
        body: str,
        payload: Optional[Dict[str, Any]] = None
    ) -> Notification:
        notification = Notification(
            user_id=user_id,
            type=type,
            title=title,
            body=body,
            payload=payload or {}
        )
        db.add(notification)
        return notification

    @classmethod
    def notify_interest_received(
        cls,
        db: Session,
        trip: Itinerary,
        applicant: User,
        message: Optional[str] = None
    ):
        """Notify trip owner that someone requested to join their trip/squad."""
        if trip.owner_id == applicant.id:
            return None
        return cls.create_notification(
            db=db,
            user_id=trip.owner_id,
            type="INTEREST_RECEIVED",
            title=f"New Squad Join Request for {trip.title}",
            body=f"{applicant.full_name or 'An explorer'} wants to join your squad for {trip.destination}.",
            payload={
                "trip_id": trip.id,
                "applicant_id": applicant.id,
                "applicant_name": applicant.full_name,
                "destination": trip.destination,
                "message": message
            }
        )

    @classmethod
    def notify_interest_resolved(
        cls,
        db: Session,
        trip: Itinerary,
        applicant_id: str,
        action: str
    ):
        """Notify applicant when their join request is approved or rejected."""
        approved = (action == "approve")
        title = "Squad Application Approved! 🎉" if approved else "Squad Application Update"
        body = (
            f"You have been approved to join the squad for {trip.title} ({trip.destination})!"
            if approved
            else f"Your request to join the squad for {trip.title} was not accepted at this time."
        )
        return cls.create_notification(
            db=db,
            user_id=applicant_id,
            type="INTEREST_APPROVED" if approved else "INTEREST_REJECTED",
            title=title,
            body=body,
            payload={
                "trip_id": trip.id,
                "destination": trip.destination,
                "action": action
            }
        )

    @classmethod
    def notify_friend_request(
        cls,
        db: Session,
        sender: User,
        recipient_id: str
    ):
        """Notify user when they receive a friend request."""
        if sender.id == recipient_id:
            return None
        return cls.create_notification(
            db=db,
            user_id=recipient_id,
            type="FRIEND_REQUEST",
            title="New Friend Request",
            body=f"{sender.full_name or 'An explorer'} sent you a friend request on DashTiny.",
            payload={
                "sender_id": sender.id,
                "sender_name": sender.full_name
            }
        )

    @classmethod
    def notify_friend_accepted(
        cls,
        db: Session,
        approver: User,
        requester_id: str
    ):
        """Notify user when their friend request is accepted."""
        return cls.create_notification(
            db=db,
            user_id=requester_id,
            type="FRIEND_ACCEPTED",
            title="Friend Request Accepted",
            body=f"{approver.full_name or 'An explorer'} accepted your friend request.",
            payload={
                "friend_id": approver.id,
                "friend_name": approver.full_name
            }
        )

    @classmethod
    def notify_squad_suggestion_created(
        cls,
        db: Session,
        squad: SquadRoom,
        author: User,
        instruction: str,
        suggestion_id: str
    ):
        """Notify all other squad members that a new itinerary suggestion was proposed."""
        members = db.query(SquadMember).filter(SquadMember.squad_id == squad.id).all()
        created = []
        for m in members:
            if m.user_id == author.id:
                continue
            notif = cls.create_notification(
                db=db,
                user_id=m.user_id,
                type="SQUAD_SUGGESTION_CREATED",
                title="New Itinerary Proposal in Squad",
                body=f"{author.full_name or 'A squad member'} suggested: \"{instruction}\"",
                payload={
                    "squad_id": squad.id,
                    "itinerary_id": squad.itinerary_id,
                    "suggestion_id": suggestion_id,
                    "author_name": author.full_name,
                    "instruction": instruction
                }
            )
            created.append(notif)
        return created

    @classmethod
    def notify_itinerary_revised(
        cls,
        db: Session,
        squad: SquadRoom,
        actor: User,
        new_version: int
    ):
        """Notify all other squad members that the canonical itinerary was updated to a new version."""
        members = db.query(SquadMember).filter(SquadMember.squad_id == squad.id).all()
        created = []
        for m in members:
            if m.user_id == actor.id:
                continue
            notif = cls.create_notification(
                db=db,
                user_id=m.user_id,
                type="ITINERARY_REVISED",
                title=f"Itinerary Updated to Revision v{new_version}",
                body=f"{actor.full_name or 'Squad planner'} accepted a proposal into the itinerary.",
                payload={
                    "squad_id": squad.id,
                    "itinerary_id": squad.itinerary_id,
                    "new_version": new_version,
                    "actor_name": actor.full_name
                }
            )
            created.append(notif)
        return created
