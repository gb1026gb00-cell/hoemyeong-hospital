# 회명병원 미디어 분리 준비 (배포 전 안전 점검)

목표: Render는 WebSocket/방/퍼즐/채팅만 처리하고, MP4/WEBP/MP3/WAV/OGG는 Cloudflare R2 Standard에서 직접 전송한다.

## 원칙
- 이 문서는 준비용이며 현재 /play 배포 동작을 변경하지 않는다.
- main, 승인된 CH01/CH02 UI, 서버 퍼즐/수집 로직은 수정하지 않는다.
- 영상 파일의 경로만 바꿀 경우 반드시 브라우저 재생, byte range 206, CORS, 모바일 autoplay를 검증한다.
- GitHub Pages는 100GB/월 소프트 대역폭 제한이 있어 1만 명 영상 배포용으로 단독 사용하지 않는다.

## 현재 확인된 Render 비용 경로
- server.js:99-120: reception_hand.mp4, G01.mp4, G08.mp4 직접 전송
- server.js:123-158: G01-G18, H01/H03/H04, intro_only, 음성, 이미지, audio 파일 직접 전송
- server.js:159-169: /play 은 approved-v172.html 을 사용하며 GitHub Pages 절대 URL을 / 상대경로로 변경함
- coop_v174_mobile_fix.js: 여러 비디오/이미지를 / 상대경로로 직접 요청
- index.html의 GitHub Pages 절대 경로만 보고 트래픽이 분리됐다고 판단하면 안 됨

## 마이그레이션 체크리스트
1. Cloudflare 계정에 R2 Standard 버킷 생성. 결제 수단과 예산 알림은 사용자 승인으로만 설정.
2. G01-G18, H01/H03/H04, intro_only, reception_hand, 모든 사용 중인 webp, mp3, wav, ogg 파일 업로드.
3. 공개 커스텀 도메인 또는 적절한 공개 전달 주소 확인; 직접 MP4 요청의 200/206, Content-Type, 캐시 정책 확인.
4. dev 브랜치에서 /play의 영상/이미지/음성 URL을 일괄 R2 origin으로 교체하되 API/WebSocket은 Render 유지.
5. CH01~최종장 모든 영상, 사진 조사, 공동 수집함, 협동 채팅, 2/4/8인 재접속 검증.
6. Render Metrics Outbound Bandwidth와 브라우저 Network의 요청 호스트 비교.
7. 기존 URL로 되돌릴 수 있도록 롤백 커밋을 보존하고 테스트 성공 전 배포 금지.

## 비용 주의
- R2는 인터넷 egress 무료지만 저장/요청 과금이 발생할 수 있다.
- Render의 동시 연결 한도와 CPU는 별도 부하 테스트가 필요하다.
- 월 10만 원은 자동 결제 상한이 아니다. 공급자별 알림/제한을 확인해야 한다.
