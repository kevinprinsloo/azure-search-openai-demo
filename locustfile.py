import random
import time

from locust import HttpUser, between, task


class ChatUser(HttpUser):
    wait_time = between(5, 20)

    @task
    def ask_question(self):
        self.client.get("/")
        time.sleep(5)
        self.client.post(
            "/chat",
            json={
                "messages": [
                    {
                        "content": random.choice(
                            [
                                "Do we have the right to assign this agreement to a third party?",
                                "What termination rights do we have?",
                                "Do we have the right to conduct a data audit of the supplier?",
                                "What losses are included or excluded from the supplier’s liability? ",
                            ]
                        ),
                        "role": "user",
                    },
                ],
                "context": {
                    "overrides": {
                        "retrieval_mode": "hybrid",
                        "semantic_ranker": True,
                        "semantic_captions": False,
                        "top": 6,
                        "suggest_followup_questions": False,
                    },
                },
            },
        )
        time.sleep(5)
        self.client.post(
            "/chat",
            json={
                "messages": [
                    {"content": "Do we have the right to assign this agreement to a third party?", "role": "user"},
                    {
                        "content": "What termination rights do we have?",
                        "role": "assistant",
                    },
                    {"content": "Do we have the right to conduct a data audit of the supplier?", "role": "user"},
                ],
                "context": {
                    "overrides": {
                        "retrieval_mode": "hybrid",
                        "semantic_ranker": True,
                        "semantic_captions": False,
                        "top": 6,
                        "suggest_followup_questions": False,
                    },
                },
            },
        )
