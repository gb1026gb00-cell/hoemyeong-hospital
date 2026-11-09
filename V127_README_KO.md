# 회명병원 V127 — 배포용 소스 통합 작업본 (미배포)

기준: 사용자가 업로드한 GitHub 저장소 b1ef7e4309e9771b721b3783002edc226675a2e6.
- index.html: 사용자가 모바일에서 승인한 V126.2 Canvas 영상/실사형 UI를 배포 진입점으로 설정.
- engine.html: GitHub 원본 게임 HTML의 바이트를 그대로 보존.
- server.js / room_storage.js / package.json: GitHub 원본 그대로 보존.
- G01~G12 / audio / assets: GitHub 원본 그대로 보존.

주의: 이 단계는 두 클라이언트를 합친 완성본이 아닙니다.
현재 index.html에는 2~8인 서버 입장/퍼즐 상태 동기화가 연결되어 있지 않습니다.
engine.html의 퍼즐/협동 기능이 index.html에서 바로 작동한다고 주장하지 않습니다.
현재 서버는 ROOM_SAVE_PATH 미설정 시 재시작 후 방 보존을 보장하지 않습니다.
라이브 GitHub/Render에 덮어쓰지 말고 검증 후 적용하세요.
