#!/usr/bin/env Rscript
# Independent estimates with the survey package for validation/crosscheck.py.
#
#   Rscript validation/crosscheck.R extract.csv jobs.json results.json
#
# Jobs are indexed with [[ ]] because $ partially matches names (job$level would
# return job$levels).
# Jobs (all on svydesign(id=~VEREP, strata=~VESTR_C, weights=~w, nest=TRUE) of the full
# file, subset() for the domain):
#   cell:     p and SE of one cell via svyby(~y, ~group, svymean) (svymean for overall)
#   group:    Wald chi-square W for equal proportions across the listed levels, from
#             svyby(..., covmat=TRUE) and vcov()
#   yeardiff: the difference between two years and its SE via svycontrast
suppressPackageStartupMessages({
  library(survey)
  library(jsonlite)
})

args <- commandArgs(trailingOnly = TRUE)
if (length(args) != 3) stop("usage: Rscript validation/crosscheck.R extract.csv jobs.json results.json")
data <- read.csv(args[[1]], stringsAsFactors = FALSE, na.strings = c("", "NA"))
jobs <- fromJSON(args[[2]], simplifyVector = FALSE)
cat(sprintf("crosscheck.R: %d rows, %d jobs\n", nrow(data), length(jobs)))

designs <- list()
design_for <- function(weight) {
  if (is.null(designs[[weight]])) {
    designs[[weight]] <<- svydesign(id = ~VEREP, strata = ~VESTR_C, weights = as.formula(paste0("~", weight)),
                                    data = data, nest = TRUE)
  }
  designs[[weight]]
}
for (w in unique(vapply(jobs, function(j) j$weight, ""))) design_for(w)

run_job <- function(job) {
  des <- design_for(job[["weight"]])
  v <- des$variables
  keep <- v$cohort == job[["cohort"]] & v$YEAR %in% unlist(job[["years"]]) & !is.na(v[[job[["indicator"]]]])
  if (!is.null(job[["group"]])) keep <- keep & !is.na(v[[job[["group"]]]])
  if (!is.null(job[["level"]])) keep <- keep & v[[job[["group"]]]] == job[["level"]]
  keep[is.na(keep)] <- FALSE
  dom <- subset(des, keep)
  f <- as.formula(paste0("~", job[["indicator"]]))
  if (job[["kind"]] == "cell") {
    if (is.null(job[["group"]])) {
      m <- svymean(f, dom)
      return(list(id = job[["id"]], p = as.numeric(coef(m)[1]), se = as.numeric(SE(m)[1])))
    }
    b <- svyby(f, as.formula(paste0("~", job[["group"]])), dom, svymean)
    i <- match(job[["level"]], rownames(b))
    return(list(id = job[["id"]], p = as.numeric(coef(b)[i]), se = as.numeric(SE(b)[i])))
  }
  if (job[["kind"]] == "group") {
    b <- svyby(f, as.formula(paste0("~", job[["group"]])), dom, svymean, covmat = TRUE)
    i <- match(unlist(job[["levels"]]), rownames(b))
    p <- as.numeric(coef(b)[i])
    V <- vcov(b)[i, i, drop = FALSE]
    C <- cbind(1, -diag(length(p) - 1))
    cp <- C %*% p
    w <- as.numeric(t(cp) %*% solve(C %*% V %*% t(C)) %*% cp)
    return(list(id = job[["id"]], w = w))
  }
  if (job[["kind"]] == "yeardiff") {
    b <- svyby(f, ~YEAR, dom, svymean, covmat = TRUE)
    ct <- rep(0, nrow(b))
    ct[match(as.character(job[["year_b"]]), rownames(b))] <- 1
    ct[match(as.character(job[["year_a"]]), rownames(b))] <- -1
    r <- svycontrast(b, list(diff = ct))
    return(list(id = job[["id"]], diff = as.numeric(coef(r)), se = as.numeric(SE(r))))
  }
  stop("unknown job kind: ", job[["kind"]])
}

cores <- if (.Platform$OS.type == "windows") 1L else max(1L, parallel::detectCores() - 2L)
results <- if (cores > 1) parallel::mclapply(jobs, run_job, mc.cores = cores) else lapply(jobs, run_job)
failed <- vapply(results, function(r) inherits(r, "try-error"), logical(1))
if (any(failed)) stop("job failed: ", results[[which(failed)[1]]])
write_json(results, args[[3]], auto_unbox = TRUE, digits = NA)
cat(sprintf("crosscheck.R: wrote %d results\n", length(results)))
