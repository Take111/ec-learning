module ec-learning/api

go 1.25.12

// NOTE: リポジトリをGitHub公開したら module を github.com/<owner>/ec-learning/api に
//       改名すること(import パスの一括置換が必要になる前に早めに)

require github.com/jackc/pgx/v5 v5.10.0

require (
	github.com/jackc/pgpassfile v1.0.0 // indirect
	github.com/jackc/pgservicefile v0.0.0-20240606120523-5a60cdf6a761 // indirect
	github.com/jackc/puddle/v2 v2.2.2 // indirect
	golang.org/x/sync v0.17.0 // indirect
	golang.org/x/text v0.29.0 // indirect
)
