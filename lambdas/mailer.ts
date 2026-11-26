import { SQSHandler } from "aws-lambda";
import { SES_EMAIL_FROM, SES_EMAIL_TO, SES_REGION } from "../env";
import {
  SESClient,
  SendEmailCommand,
  SendEmailCommandInput,
} from "@aws-sdk/client-ses";

if (!SES_EMAIL_TO || !SES_EMAIL_FROM || !SES_REGION) {
  throw new Error(
    "Add SES_EMAIL_TO, SES_EMAIL_FROM and SES_REGION to env.ts"
  );
}

type ContactDetails = {
  name: string;
  email: string;
  message: string;
};

const client = new SESClient({ region: SES_REGION });

export const handler: SQSHandler = async (event) => {
  console.log("Event ", JSON.stringify(event));

  for (const record of event.Records) {
    const recordBody = JSON.parse(record.body);
    const snsMessage = JSON.parse(recordBody.Message);

    if (snsMessage.Records) {
      console.log("Record body ", JSON.stringify(snsMessage));

      for (const s3Message of snsMessage.Records) {
        const s3e = s3Message.s3;
        const srcBucket = s3e.bucket.name;

        const srcKey = decodeURIComponent(
          s3e.object.key.replace(/\+/g, " ")
        );

        try {
          const details: ContactDetails = {
            name: "The Photo Album",
            email: SES_EMAIL_FROM,
            message:
              `We received your Image. Its URL is ` +
              `s3://${srcBucket}/${srcKey}`,
          };

          const params = sendEmailParams(details);
          await client.send(new SendEmailCommand(params));
        } catch (error: unknown) {
          console.log("ERROR is: ", error);
        }
      }
    }
  }
};

function sendEmailParams(
  details: ContactDetails
): SendEmailCommandInput {
  return {
    Destination: {
      ToAddresses: [SES_EMAIL_TO],
    },
    Message: {
      Body: {
        Html: {
          Charset: "UTF-8",
          Data: getHtmlContent(details),
        },
      },
      Subject: {
        Charset: "UTF-8",
        Data: "New image Upload",
      },
    },
    Source: SES_EMAIL_FROM,
  };
}

function getHtmlContent({
  name,
  email,
  message,
}: ContactDetails): string {
  return `
    <html>
      <body>
        <h2>Sent from:</h2>
        <ul>
          <li><b>${name}</b></li>
          <li><b>${email}</b></li>
        </ul>
        <p>${message}</p>
      </body>
    </html>
  `;
}