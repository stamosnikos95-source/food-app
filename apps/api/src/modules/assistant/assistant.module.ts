import { Body, Controller, Get, Module, Post, Req, UseGuards } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { Type } from "class-transformer";
import { ArrayMaxSize, ArrayMinSize, IsArray, IsIn, IsString, MaxLength, MinLength, ValidateNested } from "class-validator";
import { Request } from "express";
import { AuthUser } from "@food-app/shared-types";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RecommendationsModule } from "../recommendations/recommendations.module";
import { AssistantService } from "./assistant.service";

class ChatMessageDto {
  @IsIn(["user", "assistant"]) role!: "user" | "assistant";
  @IsString() @MinLength(1) @MaxLength(1000) content!: string;
}

class ChatDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(12)
  @ValidateNested({ each: true })
  @Type(() => ChatMessageDto)
  messages!: ChatMessageDto[];
}

@UseGuards(JwtAuthGuard)
@Controller("assistant")
export class AssistantController {
  constructor(private readonly assistant: AssistantService) {}

  /** The app only shows the chat when this is true. */
  @Get("config")
  config() {
    return { enabled: this.assistant.enabled() };
  }

  /** Each message costs an AI call: bounded per customer. */
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post("chat")
  chat(@Body() dto: ChatDto, @Req() req: Request & { user: AuthUser }) {
    return this.assistant.chat(req.user.id, dto.messages);
  }
}

@Module({ imports: [RecommendationsModule], controllers: [AssistantController], providers: [AssistantService] })
export class AssistantModule {}
