import json
import logging
import re
from typing import Any, AsyncGenerator, Optional, Union

import openai
from azure.search.documents.aio import SearchClient
from azure.search.documents.models import QueryType, RawVectorQuery, VectorQuery

from approaches.chatreadretrieveread import ChatReadRetrieveReadApproach
from approaches.retrievethenread import RetrieveThenReadApproach
from core.messagebuilder import MessageBuilder
from core.modelhelper import get_token_limit
from text import nonewlines

class RubricEvaluationApproach(ChatReadRetrieveReadApproach, RetrieveThenReadApproach):
    def __init__(
        self,
        search_client: SearchClient,
        openai_host: str,
        chatgpt_deployment: Optional[str],
        chatgpt_model: str,
        embedding_deployment: Optional[str],
        embedding_model: str,
        sourcepage_field: str,
        content_field: str,
        query_language: str,
        query_speller: str,
    ):
        self.search_client = search_client
        self.openai_host = openai_host
        self.chatgpt_deployment = chatgpt_deployment
        self.chatgpt_model = chatgpt_model
        self.embedding_deployment = embedding_deployment
        self.embedding_model = embedding_model
        self.sourcepage_field = sourcepage_field
        self.content_field = content_field
        self.query_language = query_language
        self.query_speller = query_speller
        self.chatgpt_token_limit = get_token_limit(chatgpt_model)
        self.logger = logging.getLogger(__name__)  

    async def run(  
        self,  
        rubric_criteria: list[str],  
        messages: list[dict],  
        stream: bool = False,  
        session_state: Any = None,  
        context: dict[str, Any] = {},  
    ) -> Union[dict[str, Any], AsyncGenerator[dict[str, Any], None]]:
            
        print("Rubric criteria:", rubric_criteria)  
        print("Messages:", messages)  
        print("Context:", context)  
        
        rubric_answers = []  # Initialize the rubric_answers variable here

        for criterion in rubric_criteria:  
            # a. Use the existing chatbot functionality to generate a search query for the current criterion  
            search_query = await self.generate_search_query(criterion, messages, context)  
                
            # b. Retrieve relevant documents from the search index using the generated search query  
            search_results = await self.retrieve_documents(search_query, context)  
                
            # c. Generate a contextual and content-specific answer using the search results and chat history  
            answer = await self.generate_answer(criterion, search_results, messages, context)  
                
            # d. Store the generated answer for the current criterion  
            rubric_answers.append(answer)  

        return {"rubric_answers": rubric_answers}  # Return a dictionary with the rubric_answers key  
    
    async def generate_search_query(self, criterion: str, messages: list[dict], context: dict[str, Any]) -> str:
        # Use the ChatReadRetrieveReadApproach's get_search_query method as a reference
        # You can modify the method to accept the criterion as a parameter and use it to generate the search query

        user_query_request = "Generate search query for: " + criterion

        messages = self.get_messages_from_history(
            system_prompt=self.query_prompt_template,
            model_id=self.chatgpt_model,
            history=messages,
            user_content=user_query_request,
            max_tokens=self.chatgpt_token_limit - len(user_query_request),
            few_shots=self.query_prompt_few_shots,
        )

        chatgpt_args = {"deployment_id": self.chatgpt_deployment} if self.openai_host == "azure" else {}
        chat_completion = await openai.ChatCompletion.acreate(
            **chatgpt_args,
            model=self.chatgpt_model,
            messages=messages,
            temperature=0.0,
            max_tokens=1024,  # Setting too low risks malformed JSON, setting too high may affect performance
            n=1,
        )

        query_text = chat_completion["choices"][0]["message"]["content"].strip()
        return query_text
    
    async def retrieve_documents(self, search_query: str, context: dict[str, Any]) -> list[str]:
        # Use the RetrieveThenReadApproach's run method as a reference
        # You can modify the method to accept the search_query as a parameter and use it to retrieve the documents

        overrides = context.get("overrides", {})
        auth_claims = context.get("auth_claims", {})
        has_text = overrides.get("retrieval_mode") in ["text", "hybrid", None]
        has_vector = overrides.get("retrieval_mode") in ["vectors", "hybrid", None]
        use_semantic_captions = True if overrides.get("semantic_captions") and has_text else False
        top = overrides.get("top", 3)
        filter = self.build_filter(overrides, auth_claims)

        # If retrieval mode includes vectors, compute an embedding for the query
        vectors: list[VectorQuery] = []
        if has_vector:
            embedding_args = {"deployment_id": self.embedding_deployment} if self.openai_host == "azure" else {}
            embedding = await openai.Embedding.acreate(**embedding_args, model=self.embedding_model, input=search_query)
            query_vector = embedding["data"][0]["embedding"]
            vectors.append(RawVectorQuery(vector=query_vector, k=50, fields="embedding"))

        # Only keep the text query if the retrieval mode uses text, otherwise drop it
        query_text = search_query if has_text else ""

        # Use semantic ranker if requested and if retrieval mode is text or hybrid (vectors + text)
        if overrides.get("semantic_ranker") and has_text:
            r = await self.search_client.search(
                query_text,
                filter=filter,
                query_type=QueryType.SEMANTIC,
                query_language=self.query_language,
                query_speller=self.query_speller,
                semantic_configuration_name="default",
                top=top,
                query_caption="extractive|highlight-false" if use_semantic_captions else None,
                vector_queries=vectors,
            )
        else:
            r = await self.search_client.search(
                query_text,
                filter=filter,
                top=top,
                vector_queries=vectors,
            )
        if use_semantic_captions:
            results = [
                doc[self.sourcepage_field] + ": " + nonewlines(" . ".join([c.text for c in doc["@search.captions"]]))
                async for doc in r
            ]
        else:
            results = [doc[self.sourcepage_field] + ": " + nonewlines(doc[self.content_field]) async for doc in r]
        content = "\n".join(results)

        return content.split('\n')
    
    async def generate_answer(
        self, criterion: str, search_results: list[str], messages: list[dict], context: dict[str, Any]
    ) -> str:
        # Use the RetrieveThenReadApproach's run method as a reference
        # You can modify the method to accept the criterion and search_results as parameters and use them to generate the answer

        overrides = context.get("overrides", {})
        content = "\n".join(search_results)

        message_builder = MessageBuilder(
            overrides.get("prompt_template") or self.system_chat_template, self.chatgpt_model
        )

        # Add user question
        user_content = criterion + "\n" + f"Sources:\n {content}"
        message_builder.insert_message("user", user_content)

        # Add shots/samples. This helps model to mimic response and make sure they match rules laid out in system message.
        message_builder.insert_message("assistant", self.answer)
        message_builder.insert_message("user", self.question)

        messages = message_builder.messages
        chatgpt_args = {"deployment_id": self.chatgpt_deployment} if self.openai_host == "azure" else {}
        chat_completion = await openai.ChatCompletion.acreate(
            **chatgpt_args,
            model=self.chatgpt_model,
            messages=messages,
            temperature=overrides.get("temperature") or 0.3,
            max_tokens=1024,
            n=1,
        )

        answer = chat_completion["choices"][0]["message"]["content"].strip()
        return answer