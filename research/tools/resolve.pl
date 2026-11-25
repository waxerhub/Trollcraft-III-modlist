#!/usr/bin/perl
# Builds tag_members.tsv (transitively closed) and *_resolved.tsv views
# from the Indexer's tags.tsv / by_output.tsv / by_ingredient.tsv.
#
# Usage: perl -I. resolve.pl <indexDir>
use strict; use warnings;

my $I = shift or die "need index dir\n";

# ---- read tags -------------------------------------------------------------
# tags.tsv rows: <ns>:<kind>/<path>  \t jar \t replace \t member
my (%members, %jarOf);
open my $fh, '<', "$I/tags.tsv" or die $!;
<$fh>;
while (<$fh>) {
  chomp; my ($id, $jar, $rep, $m) = split /\t/, $_, 4;
  next unless defined $m && length $m;
  my ($ns, $rest) = split /:/, $id, 2;
  next unless defined $rest;
  my ($kind, $path) = $rest =~ m{^([^/]+)/(.*)$} ? ($1, $2) : (undef, undef);
  next unless defined $path;
  my $key = "$kind|$ns:$path";
  push @{ $members{$key} }, $m;
  $jarOf{$key} ||= $jar;
}
close $fh;

# ---- transitive closure ----------------------------------------------------
my %closed;
sub expand {
  my ($key, $seen) = @_;
  return @{ $closed{$key} } if $closed{$key};
  return () if $seen->{$key}++;
  my ($kind) = split /\|/, $key;
  my %out;
  for my $m (@{ $members{$key} || [] }) {
    if ($m =~ /^#(.*)$/) {
      my $sub = "$kind|$1";
      $out{$_} = 1 for expand($sub, $seen);
      $out{"#$1"} = 1 unless exists $members{$sub};   # dangling tag ref
    } else { $out{$m} = 1 }
  }
  my @r = sort keys %out;
  $closed{$key} = \@r;
  return @r;
}

open my $tm, '>', "$I/tag_members.tsv" or die $!;
print $tm "kind\ttag\tjar\tmember\n";
for my $key (sort keys %members) {
  my ($kind, $tag) = split /\|/, $key, 2;
  for my $m (expand($key, {})) {
    print $tm "$kind\t$tag\t", ($jarOf{$key} // ''), "\t$m\n";
  }
}
close $tm;

# lookup: tag -> items, trying items then blocks then fluids
sub tag_items {
  my ($tag) = @_;
  for my $kind (qw(items blocks fluids)) {
    my $key = "$kind|$tag";
    next unless exists $members{$key};
    my @r = expand($key, {});
    return @r if @r;
  }
  return ();
}

# ---- resolved views --------------------------------------------------------
for my $pair (['by_output', 'output'], ['by_ingredient', 'input']) {
  my ($file, $col) = @$pair;
  open my $in, '<', "$I/$file.tsv" or die $!;
  open my $out, '>', "$I/${file}_resolved.tsv" or die $!;
  my $hdr = <$in>; chomp $hdr;
  print $out "$col\tvia_tag\trecipe_id\ttype\tjar\n";
  while (<$in>) {
    chomp; my ($v, $rid, $type, $jar) = split /\t/;
    next unless defined $jar;
    if ($v =~ /^#(.*)$/) {
      my $tag = $1;
      $tag =~ s/^fluid://;
      my @items = tag_items($tag);
      if (@items) { print $out "$_\t$tag\t$rid\t$type\t$jar\n" for @items }
      else { print $out "#$tag\t\t$rid\t$type\t$jar\n" }
    } else {
      print $out "$v\t\t$rid\t$type\t$jar\n";
    }
  }
  close $in; close $out;
}

printf "tag_members.tsv, by_output_resolved.tsv, by_ingredient_resolved.tsv written (%d tags)\n",
  scalar keys %members;
