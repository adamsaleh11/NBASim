import { ObjectType, Field, ID } from '@nestjs/graphql';

@ObjectType()
export class TeamDTO {
  @Field(() => ID)
  id: string;

  @Field()
  name: string;

  @Field()
  conference: string;

  @Field()
  division: string;

  @Field({ nullable: true })
  abbreviation?: string;

  @Field({ nullable: true })
  teamLogoUrl?: string;

  @Field({ nullable: true })
  primaryColor?: string;

  @Field({ nullable: true })
  secondaryColor?: string;
}