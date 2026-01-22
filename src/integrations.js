import { compliant } from "./compliantClient";




export const Core = compliant.integrations.Core;

export const InvokeLLM = compliant.integrations.Core.InvokeLLM;

export const SendEmail = compliant.integrations.Core.SendEmail;

export const UploadFile = compliant.integrations.Core.UploadFile;

export const GenerateImage = compliant.integrations.Core.GenerateImage;

export const ExtractDataFromUploadedFile = compliant.integrations.Core.ExtractDataFromUploadedFile;

export const CreateFileSignedUrl = compliant.integrations.Core.CreateFileSignedUrl;

export const UploadPrivateFile = compliant.integrations.Core.UploadPrivateFile;

// Adobe helpers
export const Adobe = compliant.integrations.Core.Adobe;
export const CreateTransientDocument = compliant.integrations.Core.Adobe.CreateTransientDocument;
export const CreateAgreement = compliant.integrations.Core.Adobe.CreateAgreement;
export const GetSigningUrl = compliant.integrations.Core.Adobe.GetSigningUrl;






