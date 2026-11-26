import { SQSBatchItemFailure, SQSHandler } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  PutCommand,
} from "@aws-sdk/lib-dynamodb";

const ddbDocClient = createDDbDocClient();

export const handler: SQSHandler = async (event) => {
  console.log("Event ", JSON.stringify(event));

  const batchItemFailures: SQSBatchItemFailure[] = [];

  for (const record of event.Records) {
    try {
      const recordBody = JSON.parse(record.body);
      const snsMessage = JSON.parse(recordBody.Message);

      console.log("Record body ", JSON.stringify(snsMessage));

      if (snsMessage.Records) {
        for (const s3Message of snsMessage.Records) {
          const srcKey = decodeURIComponent(
            s3Message.s3.object.key.replace(/\+/g, " ")
          );

          const typeMatch = srcKey.match(/\.([^.]*)$/);

          if (!typeMatch) {
            throw new Error("Could not determine the image type.");
          }

          const imageType = typeMatch[1].toLowerCase();

          if (
            imageType !== "jpeg" &&
            imageType !== "jpg" &&
            imageType !== "png"
          ) {
            throw new Error(`Unsupported image type: ${imageType}`);
          }

          await ddbDocClient.send(
            new PutCommand({
              TableName: process.env.TABLE_NAME,
              Item: {
                name: srcKey,
              },
            })
          );
        }
      }
    } catch (error) {
      console.log(`Message ${record.messageId} failed: `, error);

      batchItemFailures.push({
        itemIdentifier: record.messageId,
      });
    }
  }

  return { batchItemFailures };
};

function createDDbDocClient() {
  const ddbClient = new DynamoDBClient({
    region: process.env.REGION,
  });

  return DynamoDBDocumentClient.from(ddbClient, {
    marshallOptions: {
      convertEmptyValues: true,
      removeUndefinedValues: true,
      convertClassInstanceToMap: true,
    },
    unmarshallOptions: {
      wrapNumbers: false,
    },
  });
}