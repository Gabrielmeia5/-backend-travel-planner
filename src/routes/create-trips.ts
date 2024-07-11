import { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { getMailClient } from "../lib/mail";
import nodemailer from "nodemailer";
import { dayjs } from "../lib/dayjs";
import { ClientError } from "../errors/client-error";
import { env } from "../env";

export async function createTrip(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().post(
    "/trips",
    {
      schema: {
        body: z.object({
          destination: z.string().min(4),
          starts_at: z.coerce.date(),
          ends_at: z.coerce.date(),
          owner_name: z.string(),
          owner_email: z.string().email(),
          emails_to_invite: z.array(z.string().email()),
        }),
      },
    },
    async (request) => {
      const {
        destination,
        starts_at,
        ends_at,
        owner_name,
        owner_email,
        emails_to_invite,
      } = request.body;

      if (dayjs(starts_at).isBefore(new Date())) {
        throw new ClientError("Invalid trip start date!");
      }
      if (dayjs(starts_at).isAfter(ends_at)) {
        throw new ClientError("Invalid trip end date!");
      }

      const trip = await prisma.trip.create({
        data: {
          destination,
          starts_at,
          ends_at,
          participants: {
            createMany: {
              data: [
                {
                  name: owner_name,
                  email: owner_email,
                  is_owner: true,
                  is_confirmed: true,
                },
                ...emails_to_invite.map((email) => {
                  return { email };
                }),
              ],
            },
          },
        },
      });

      const formattedStartDate = dayjs().format("LL");
      const formattedEndDate = dayjs().format("LL");
      const confirmationLink = `${env.API_BASE_URL}/trips/${trip.id}/confirm`;

      const mail = await getMailClient();
      const message = await mail.sendMail({
        from: {
          name: "Trip Planner",
          address: "tripplanner@tripplanner.com",
        },

        to: {
          name: owner_name,
          address: owner_email,
        },
        subject: "Trip created!",

        html: `
             <div style="font-family: sans-serif; font-size: 16px; line-height: 1.6;">
             <p>Você solicitou a criação de uma viagem para <strong>${destination}</strong> nas datas de <strong>${formattedStartDate}</strong> até <strong>${formattedEndDate}</strong>.</p>
             <p></p>
             <p>Para confirmar sua viagem, clique no link abaixo:</p>
             <p></p>
             <p>
               <a href="${confirmationLink}">Confirmar viagem</a>
             </p>
             <p></p>
             <p>Caso você não saiba do que se trata esse e-mail, apenas ignore esse e-mail.</p>
            </div> 
            `.trim(),
      });

      console.log(nodemailer.getTestMessageUrl(message));

      return {
        tripsId: trip.id,
      };
    }
  );
}
