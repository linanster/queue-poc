import { Global, Module } from '@nestjs/common';
import { QrSignatureService } from './qr-signature.service';

@Global()
@Module({
  providers: [QrSignatureService],
  exports: [QrSignatureService],
})
export class CommonModule {}
