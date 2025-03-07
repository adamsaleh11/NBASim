import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type TeamDocument = Team & Document;

@Schema({ timestamps: true })
export class Team {
  @Prop({ required: true, unique: true })
  name: string;

  @Prop({ required: true })
  conference: string;

  @Prop({ required: true })
  division: string;

  @Prop()
  abbreviation: string;

  @Prop()
  teamLogoUrl: string;

  @Prop()
  primaryColor: string;

  @Prop()
  secondaryColor: string;
}

export const TeamSchema = SchemaFactory.createForClass(Team);