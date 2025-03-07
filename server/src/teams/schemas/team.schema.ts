import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { Document, URL } from 'mongoose'; // Import URL for validation

export type TeamDocument = Team & Document & { _id: mongoose.Types.ObjectId };

@Schema({ timestamps: true })
export class Team {
  @Prop({ required: true, unique: true, maxlength: 255 }) // Example maxlength for name
  name: string;

  @Prop({ required: true, enum: ['Eastern', 'Western'] })
  conference: string;

  @Prop({
    required: true,
    enum: ['Atlantic', 'Central', 'Southeast', 'Northwest', 'Pacific', 'Southwest'],
    maxlength: 20, // Example maxlength for division
  })
  division: string;

  @Prop({ required: true, maxlength: 3 }) // Example: Abbreviation assumed to be 3 chars
  abbreviation: string;

  @Prop({
    validate: { // Optional URL validation
      validator: (value: string) => {
        if (!value) return true; // Allow null or undefined
        try {
          new URL(value);
          return true;
        } catch (error) {
          return false;
        }
      },
      message: 'teamLogoUrl must be a valid URL',
    },
  })
  teamLogoUrl: string;

  @Prop({ default: null, maxlength: 7 }) // Example maxlength for color codes (like #RRGGBB)
  primaryColor: string;

  @Prop({ default: null, maxlength: 7 }) // Example maxlength for color codes
  secondaryColor: string;
}

export const TeamSchema = SchemaFactory.createForClass(Team);
TeamSchema.index({ name: 1 }, { unique: true }); // Ensure efficient lookups by name