const BACKEND_URI = "";

import { ChatAppResponse, ChatAppResponseOrError, ChatAppRequest, Config } from "./models";
import { useLogin, appServicesToken } from "../authConfig";

function getHeaders(idToken: string | undefined): Record<string, string> {
    var headers: Record<string, string> = {
        "Content-Type": "application/json"
    };
    // If using login and not using app services, add the id token of the logged in account as the authorization
    if (useLogin && appServicesToken == null) {
        if (idToken) {
            headers["Authorization"] = `Bearer ${idToken}`;
        }
    }

    return headers;
}

export async function askApi(request: ChatAppRequest, idToken: string | undefined): Promise<ChatAppResponse> {
    const response = await fetch(`${BACKEND_URI}/ask`, {
        method: "POST",
        headers: getHeaders(idToken),
        body: JSON.stringify(request)
    });

    const parsedResponse: ChatAppResponseOrError = await response.json();
    if (response.status > 299 || !response.ok) {
        throw Error(parsedResponse.error || "Unknown error");
    }

    return parsedResponse as ChatAppResponse;
}

export async function configApi(idToken: string | undefined): Promise<Config> {
    const response = await fetch(`${BACKEND_URI}/config`, {
        method: "GET",
        headers: getHeaders(idToken)
    });

    return (await response.json()) as Config;
}

export async function chatApi(request: ChatAppRequest, idToken: string | undefined): Promise<Response> {
    return await fetch(`${BACKEND_URI}/chat`, {
        method: "POST",
        headers: getHeaders(idToken),
        body: JSON.stringify(request)
    });
}

export function getCitationFilePath(citation: string): string {
    return `${BACKEND_URI}/content/${citation}`;
}

// In frontend/src/api/api.ts

export async function evaluateRubric(rubricCriteria: any[], messages: any[]) {
    const response = await fetch("/api/rubric-evaluation", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ rubric_criteria: rubricCriteria, messages: messages })
    });

    if (!response.ok) {
        throw new Error(`Error: ${response.statusText}`);
    }

    return await response.json();
}

export async function uploadFile(file: File, idToken: string | undefined): Promise<string> {  
    const formData = new FormData();  
    formData.append('file', file);  
  
    const response = await fetch(`${BACKEND_URI}/upload_rubric`, {  
        method: "POST",  
        headers: getHeaders(idToken),  
        body: formData  
    });  
  
    if (!response.ok) {  
        throw new Error(`Error: ${response.statusText}`);  
    }  
  
    return await response.text();  // Assuming the response is a text string (SAS URL)  
}  
  
export async function getRubricFiles(idToken: string | undefined): Promise<any> {  
    const response = await fetch(`${BACKEND_URI}/get_rubric_files`, {  
        method: "GET",  
        headers: getHeaders(idToken)  
    });  
  
    if (!response.ok) {  
        throw new Error(`Error: ${response.statusText}`);  
    }  
  
    return await response.json();  // Assuming the response is a JSON object  
}  
  
export async function getCsvSasUrl(file: string, idToken: string | undefined): Promise<string> {  
    const response = await fetch(`${BACKEND_URI}/get_csv_sas_url?file=${encodeURIComponent(file)}`, {  
        method: "GET",  
        headers: getHeaders(idToken)  
    });  
  
    if (!response.ok) {  
        throw new Error(`Error: ${response.statusText}`);  
    }  
  
    return await response.text();  // Assuming the response is a text string (SAS URL)  
}  
