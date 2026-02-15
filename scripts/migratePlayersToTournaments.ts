async function main() {
  console.log(
    'This migration script is deprecated because the legacy Player.tournament column is no longer in the schema.'
  );
  console.log('No action was performed.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
