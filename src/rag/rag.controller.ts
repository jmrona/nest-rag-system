import { Controller, Post, Body } from '@nestjs/common';
import { RagService } from './rag.service';
import { GenerateCommentDto } from './dto/generate-comment.dto';

@Controller('rag')
export class RagController {
  constructor(private readonly ragService: RagService) {}

  @Post('generate-comment')
  async generateComment(@Body() generateCommentDto: GenerateCommentDto) {
    // Force British English in the generated comment
    const comment = await this.ragService.generateDoctorComment({
      ...generateCommentDto
    });
    return { comment };
  }
}