# PTLog Frontend

이 프로젝트는 트레이너와 회원 관리를 위한 React + Vite 애플리케이션입니다. Cloudflare Pages 같은 정적 호스팅 환경에서 동작하도록 구성되어 있으며, GitHub에 push하면 Cloudflare가 자동으로 최신 코드를 배포합니다.

## 개발 및 배포 흐름

1. 필요한 변경 사항을 로컬 리포지토리에 반영합니다. (로컬에서 직접 실행하지 않더라도 됩니다.)
2. 변경 사항을 커밋하고 GitHub 저장소에 push합니다.
3. Cloudflare Pages가 GitHub 리포지토리의 변경을 감지하여 새 배포를 생성합니다.
4. Cloudflare 배포 URL에서 변경 사항을 확인합니다.

> ⚠️ Supabase 키 등 민감한 설정은 `.env` 파일에 두고 Git에 커밋하지 마세요. Cloudflare Pages 프로젝트 설정에서 환경 변수를 등록하면 빌드와 런타임에서 사용됩니다.

## 로컬에서 실행 (선택 사항)

```bash
npm install
npm run dev
```

로컬 개발 서버를 띄우면 http://localhost:5173 에서 확인할 수 있습니다.

## 빌드

```bash
npm run build
```

프로덕션 번들을 `dist/` 디렉터리에 생성합니다. CI나 Cloudflare Pages에서 동일한 명령을 실행하여 정적 파일을 배포합니다.

## 코드 스타일

- React 함수형 컴포넌트를 사용합니다.
- Tailwind CSS 유틸리티 클래스를 활용합니다.
- 새로운 의존성을 추가하는 경우 `package.json`을 함께 업데이트하세요.

## 문의

배포나 동작에 문제가 있다면 Cloudflare Pages의 배포 로그와 브라우저 콘솔 로그를 함께 확인해 주세요.
