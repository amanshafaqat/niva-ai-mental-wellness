import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ConversationsService } from './conversations.service';
import { UserGuard } from '../authorization/guards/user.guard';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { SendMessageDto } from './dto/send-message.dto';
import { UpdateUserPreferencesDto } from './dto/update-preferences.dto';

@Controller('conversations')
@UseGuards(UserGuard)
export class ConversationsController {
  constructor(private readonly conversationsService: ConversationsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async startConversation(@Req() req: any, @Body() dto: CreateConversationDto) {
    const userId = req.user.id;
    return this.conversationsService.startConversation(userId, dto?.title);
  }

  @Get()
  async getMyConversations(@Req() req: any) {
    const userId = req.user.id;
    return this.conversationsService.getUserConversations(userId);
  }

  @Get('preferences')
  async getPreferences(@Req() req: any) {
    const userId = req.user.id;
    return this.conversationsService.getPreferences(userId);
  }

  @Put('preferences')
  async updatePreferences(@Req() req: any, @Body() dto: UpdateUserPreferencesDto) {
    const userId = req.user.id;
    return this.conversationsService.updatePreferences(userId, dto);
  }

  @Get('metrics')
  async getMetrics() {
    return this.conversationsService.getMetrics();
  }

  @Get(':id')
  async getConversation(@Req() req: any, @Param('id') id: string) {
    const userId = req.user.id;
    return this.conversationsService.getConversation(userId, id);
  }

  @Post(':id/messages')
  @HttpCode(HttpStatus.CREATED)
  async postMessage(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: SendMessageDto,
  ) {
    const userId = req.user.id;
    return this.conversationsService.postMessage(userId, id, dto.content);
  }

  @Post(':id/end')
  @HttpCode(HttpStatus.OK)
  async endConversation(@Req() req: any, @Param('id') id: string) {
    const userId = req.user.id;
    return this.conversationsService.endConversation(userId, id);
  }
}
